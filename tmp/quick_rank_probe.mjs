// src/engines/district/clustering/dbscan.ts
var UNASSIGNED = -1;
var NOISE = -2;
function unique(values) {
  return [...new Set(values)];
}
function regionQuery(points, index, epsM, distance) {
  const neighbors = [];
  for (let currentIndex = 0; currentIndex < points.length; currentIndex += 1) {
    if (distance(points[index], points[currentIndex]) <= epsM) {
      neighbors.push(currentIndex);
    }
  }
  return neighbors;
}
function expandCluster(input, seedIndex, clusterId, initialNeighbors, assignments, visited) {
  assignments[seedIndex] = clusterId;
  const queue = [...initialNeighbors];
  while (queue.length > 0) {
    const candidateIndex = queue.shift();
    if (candidateIndex === void 0) {
      continue;
    }
    if (!visited[candidateIndex]) {
      visited[candidateIndex] = true;
      const candidateNeighbors = regionQuery(
        input.points,
        candidateIndex,
        input.epsM,
        input.distance
      );
      if (candidateNeighbors.length >= input.minPoints) {
        queue.push(...candidateNeighbors);
      }
    }
    if (assignments[candidateIndex] === UNASSIGNED || assignments[candidateIndex] === NOISE) {
      assignments[candidateIndex] = clusterId;
    }
  }
}
function dbscan(input) {
  if (input.points.length === 0) {
    return { clusters: [], noiseIndices: [] };
  }
  const visited = new Array(input.points.length).fill(false);
  const assignments = new Array(input.points.length).fill(UNASSIGNED);
  let clusterCount = 0;
  for (let index = 0; index < input.points.length; index += 1) {
    if (visited[index]) {
      continue;
    }
    visited[index] = true;
    const neighbors = regionQuery(input.points, index, input.epsM, input.distance);
    if (neighbors.length < input.minPoints) {
      assignments[index] = NOISE;
      continue;
    }
    clusterCount += 1;
    expandCluster(input, index, clusterCount, neighbors, assignments, visited);
  }
  const clusters = [];
  for (let clusterId = 1; clusterId <= clusterCount; clusterId += 1) {
    const pointIndices = unique(
      assignments.map((assignment, index) => ({ assignment, index })).filter(({ assignment }) => assignment === clusterId).map(({ index }) => index)
    );
    if (pointIndices.length === 0) {
      continue;
    }
    clusters.push({
      id: `cluster-${clusterId}`,
      pointIndices,
      points: pointIndices.map((index) => input.points[index])
    });
  }
  const noiseIndices = assignments.map((assignment, index) => ({ assignment, index })).filter(({ assignment }) => assignment === NOISE).map(({ index }) => index);
  return { clusters, noiseIndices };
}

// src/engines/district/clustering/geoDistance.ts
var EARTH_RADIUS_M = 6371e3;
var DEG_TO_RAD = Math.PI / 180;
function haversineDistanceM(a, b) {
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;
  const deltaLat = (b.lat - a.lat) * DEG_TO_RAD;
  const deltaLng = (b.lng - a.lng) * DEG_TO_RAD;
  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);
  const haversineTerm = sinDeltaLat * sinDeltaLat + Math.cos(lat1) * Math.cos(lat2) * sinDeltaLng * sinDeltaLng;
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversineTerm), Math.sqrt(1 - haversineTerm));
  return EARTH_RADIUS_M * angularDistance;
}
function centroidOf(points) {
  if (points.length === 0) {
    return { lat: 0, lng: 0 };
  }
  const sum = points.reduce(
    (accumulator, point) => ({
      lat: accumulator.lat + point.lat,
      lng: accumulator.lng + point.lng
    }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length
  };
}
function projectToLocalMeters(reference, point) {
  const latDeltaM = (point.lat - reference.lat) * 111320;
  const lngScale = Math.cos(reference.lat * DEG_TO_RAD) * 111320;
  const lngDeltaM = (point.lng - reference.lng) * lngScale;
  return { xM: lngDeltaM, yM: latDeltaM };
}
function computeBoundingBoxMetrics(points) {
  if (points.length <= 1) {
    return { widthM: 0, heightM: 0 };
  }
  const centroid = centroidOf(points);
  const projected = points.map((point) => projectToLocalMeters(centroid, point));
  const xValues = projected.map((point) => point.xM);
  const yValues = projected.map((point) => point.yM);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  return {
    widthM: Math.max(0, maxX - minX),
    heightM: Math.max(0, maxY - minY)
  };
}

// src/engines/district/clustering/formRawPockets.ts
var ZERO_GEOMETRY = {
  centroid: { lat: 0, lng: 0 },
  maxDistanceFromCentroidM: 0,
  avgDistanceFromCentroidM: 0,
  maxPairwiseDistanceM: 0,
  bboxWidthM: 0,
  bboxHeightM: 0,
  elongationRatio: 1,
  areaM2: 0,
  effectiveAreaM2ForDensity: 0,
  densityAreaFloorApplied: false,
  densityClamped: false,
  densityEntitiesPerKm2: 0
};
var MIN_EFFECTIVE_DENSITY_AREA_M2 = 25e3;
var MAX_DENSITY_PER_KM2 = 450;
function toFixedNumber(value) {
  return Number(value.toFixed(2));
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function getCategoryKey(entity) {
  return entity.categories[0] ?? entity.type;
}
function computeCategoryCounts(entities) {
  return entities.reduce((accumulator, entity) => {
    const key = getCategoryKey(entity);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}
function computeLaneDiversityScore(entities) {
  if (entities.length === 0) {
    return 0;
  }
  const uniqueCategories = new Set(entities.map(getCategoryKey));
  return clamp(uniqueCategories.size / Math.min(entities.length, 6), 0, 1);
}
function computeMaxPairwiseDistanceM(entities) {
  if (entities.length <= 1) {
    return 0;
  }
  let maxDistanceM = 0;
  for (let left = 0; left < entities.length; left += 1) {
    for (let right = left + 1; right < entities.length; right += 1) {
      const distanceM = haversineDistanceM(entities[left].location, entities[right].location);
      if (distanceM > maxDistanceM) {
        maxDistanceM = distanceM;
      }
    }
  }
  return maxDistanceM;
}
function computeGeometryMetrics(entities) {
  if (entities.length === 0) {
    return ZERO_GEOMETRY;
  }
  const points = entities.map((entity) => entity.location);
  const centroid = centroidOf(points);
  const distancesFromCentroidM = points.map((point) => haversineDistanceM(point, centroid));
  const maxDistanceFromCentroidM = distancesFromCentroidM.length === 0 ? 0 : Math.max(...distancesFromCentroidM);
  const avgDistanceFromCentroidM = distancesFromCentroidM.length === 0 ? 0 : distancesFromCentroidM.reduce((sum, distanceM) => sum + distanceM, 0) / distancesFromCentroidM.length;
  const maxPairwiseDistanceM = computeMaxPairwiseDistanceM(entities);
  const { widthM: bboxWidthM, heightM: bboxHeightM } = computeBoundingBoxMetrics(points);
  const shortestAxis = Math.max(1, Math.min(bboxWidthM, bboxHeightM));
  const longestAxis = Math.max(bboxWidthM, bboxHeightM);
  const elongationRatio = longestAxis / shortestAxis;
  const areaM2 = bboxWidthM * bboxHeightM;
  const effectiveAreaM2ForDensity = Math.max(areaM2, MIN_EFFECTIVE_DENSITY_AREA_M2);
  const densityAreaFloorApplied = areaM2 < MIN_EFFECTIVE_DENSITY_AREA_M2;
  const rawDensityEntitiesPerKm2 = entities.length / (effectiveAreaM2ForDensity / 1e6);
  const densityEntitiesPerKm2 = Math.min(rawDensityEntitiesPerKm2, MAX_DENSITY_PER_KM2);
  const densityClamped = rawDensityEntitiesPerKm2 > MAX_DENSITY_PER_KM2;
  return {
    centroid,
    maxDistanceFromCentroidM: toFixedNumber(maxDistanceFromCentroidM),
    avgDistanceFromCentroidM: toFixedNumber(avgDistanceFromCentroidM),
    maxPairwiseDistanceM: toFixedNumber(maxPairwiseDistanceM),
    bboxWidthM: toFixedNumber(bboxWidthM),
    bboxHeightM: toFixedNumber(bboxHeightM),
    elongationRatio: toFixedNumber(elongationRatio),
    areaM2: toFixedNumber(areaM2),
    effectiveAreaM2ForDensity: toFixedNumber(effectiveAreaM2ForDensity),
    densityAreaFloorApplied,
    densityClamped,
    densityEntitiesPerKm2: toFixedNumber(densityEntitiesPerKm2)
  };
}
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function buildStableRawPocketId(entities) {
  const sortedEntityIds = [...entities.map((entity) => entity.id)].sort();
  const signature = sortedEntityIds.join("|");
  return `raw-pocket-${hashString(signature)}`;
}
function buildRawPocketFromEntities(entities, clustering, options) {
  const geometry = computeGeometryMetrics(entities);
  const pocketId = options.pocketId ?? buildStableRawPocketId(entities);
  return {
    id: pocketId,
    origin: options.origin,
    entities,
    entityIds: entities.map((entity) => entity.id),
    categoryCounts: computeCategoryCounts(entities),
    laneDiversityScore: toFixedNumber(computeLaneDiversityScore(entities)),
    geometry,
    originMeta: {
      clusteringSource: options.clusteringSource,
      stageNotes: options.stageNotes ?? [],
      sourcePocketId: options.sourcePocketId
    },
    clusteringMeta: {
      epsM: clustering.epsM,
      minPoints: clustering.minPoints,
      maxRadiusCapM: clustering.maxRadiusCapM,
      radiusCapExceeded: geometry.maxDistanceFromCentroidM > clustering.maxRadiusCapM
    },
    meta: {
      provenance: [
        "geo-dbscan",
        "cluster-geometry-metrics",
        `origin:${options.origin}`,
        `clustering-source:${options.clusteringSource}`
      ],
      formedAtIso: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
}
function formRawPockets(input) {
  if (input.entities.length === 0) {
    return [];
  }
  const clusteringResult = dbscan({
    points: input.entities,
    epsM: input.clustering.epsM,
    minPoints: input.clustering.minPoints,
    distance: (left, right) => haversineDistanceM(left.location, right.location)
  });
  return clusteringResult.clusters.map(
    (cluster) => buildRawPocketFromEntities(cluster.points, input.clustering, {
      origin: input.origin ?? "primary",
      clusteringSource: input.clusteringSource ?? "primary",
      stageNotes: input.stageNotes
    })
  ).sort((left, right) => {
    if (right.entities.length !== left.entities.length) {
      return right.entities.length - left.entities.length;
    }
    return left.id.localeCompare(right.id);
  });
}

// src/engines/district/debug/buildDistrictDebugTrace.ts
function getRejectionReasonSummary(reasons) {
  const explicitReject = reasons.find((reason) => reason.startsWith("Rejected:"));
  if (explicitReject) {
    return explicitReject;
  }
  const classificationReject = reasons.find((reason) => reason.includes("Rejected pocket:"));
  if (classificationReject) {
    return classificationReject;
  }
  return reasons[reasons.length - 1] ?? "Rejected pocket without explicit reason.";
}
function toSortedCountEntries(counts, limit) {
  return Object.entries(counts).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  }).slice(0, limit).map(([key, count]) => ({ key, count }));
}
function buildLaneCounts(pocket) {
  return pocket.entities.reduce((accumulator, entity) => {
    const laneKey = entity.type;
    accumulator[laneKey] = (accumulator[laneKey] ?? 0) + 1;
    return accumulator;
  }, {});
}
function buildCompositionSnapshot(pocket) {
  const laneCounts = buildLaneCounts(pocket);
  const representativeEntityNames = [...pocket.entities].map((entity) => entity.name).sort((left, right) => left.localeCompare(right)).slice(0, 5);
  return {
    topCategories: toSortedCountEntries(pocket.categoryCounts, 4),
    dominantLanes: toSortedCountEntries(laneCounts, 4),
    categoryDiversityCount: Object.keys(pocket.categoryCounts).length,
    laneDiversityCount: Object.keys(laneCounts).length,
    laneDiversityScore: pocket.laneDiversityScore,
    representativeEntityNames
  };
}
function formatReasonBuckets(reasons) {
  const entries = Object.entries(reasons).filter(([, count]) => count > 0).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 3).map(([reason, count]) => `${reason} (${count})`);
  return entries.length > 0 ? entries.join(", ") : "none";
}
function toHyperlocalSnapshot(profile) {
  if (!profile?.hyperlocal) {
    return void 0;
  }
  const primary = profile.hyperlocal.primaryMicroPocket;
  const secondary = profile.hyperlocal.secondaryMicroPockets;
  const anchorRanking = [
    ...profile.hyperlocal.primaryAnchor ? [
      {
        entityId: profile.hyperlocal.primaryAnchor.entityId,
        score: profile.hyperlocal.primaryAnchor.score
      }
    ] : [],
    ...profile.hyperlocal.secondaryAnchors.map((anchor) => ({
      entityId: anchor.entityId,
      score: anchor.score
    }))
  ].slice(0, 4);
  return {
    microPocketCount: 1 + secondary.length,
    selectedMicroPocketId: primary.id,
    activationStrength: primary.activationStrength,
    environmentalInfluencePotential: primary.environmentalInfluencePotential,
    anchorRanking,
    whyHereSignals: profile.hyperlocal.whyHereSignals,
    localSpecificityScore: profile.hyperlocal.localSpecificityScore
  };
}
function buildDistrictDebugTrace(input) {
  const rankedByPocketId = new Map(input.ranked.map((entry) => [entry.profile.pocketId, entry]));
  const selectedPocketIds = new Set(input.selected.map((entry) => entry.profile.pocketId));
  const profileByPocketId = new Map(input.profiles.map((profile) => [profile.pocketId, profile]));
  const rawPocketSizes = input.rawPockets.map((pocket) => ({
    pocketId: pocket.id,
    entityCount: pocket.entities.length,
    origin: pocket.origin,
    clusteringSource: pocket.originMeta.clusteringSource
  }));
  const rejectedPockets = input.viability.rejected.map((pocket) => ({
    pocketId: pocket.id,
    origin: pocket.origin,
    clusteringSource: pocket.originMeta.clusteringSource,
    entityCount: pocket.entities.length,
    rejectionReasonSummary: getRejectionReasonSummary(pocket.viability.reasons),
    rejectionReasons: pocket.viability.reasons,
    geometry: {
      centroid: pocket.geometry.centroid,
      maxDistanceFromCentroidM: pocket.geometry.maxDistanceFromCentroidM,
      avgDistanceFromCentroidM: pocket.geometry.avgDistanceFromCentroidM,
      maxPairwiseDistanceM: pocket.geometry.maxPairwiseDistanceM,
      bboxWidthM: pocket.geometry.bboxWidthM,
      bboxHeightM: pocket.geometry.bboxHeightM,
      elongationRatio: pocket.geometry.elongationRatio,
      areaM2: pocket.geometry.areaM2,
      densityEntitiesPerKm2: pocket.geometry.densityEntitiesPerKm2
    }
  }));
  const rawPocketSizeSummary = rawPocketSizes.length > 0 ? rawPocketSizes.map(
    (entry) => `${entry.pocketId} (${entry.entityCount}, ${entry.origin}/${entry.clusteringSource})`
  ).join("; ") : "none";
  const pocketTraces = input.viability.evaluated.map((pocket) => ({
    pocketId: pocket.id,
    origin: pocket.origin,
    clusteringSource: pocket.originMeta.clusteringSource,
    classification: pocket.viability.classification,
    finalRank: rankedByPocketId.get(pocket.id)?.rank,
    finalScore: rankedByPocketId.get(pocket.id)?.score,
    selected: selectedPocketIds.has(pocket.id),
    stageNotes: pocket.originMeta.stageNotes,
    notes: pocket.viability.reasons,
    hyperlocal: toHyperlocalSnapshot(profileByPocketId.get(pocket.id)),
    metrics: {
      maxDistanceFromCentroidM: pocket.geometry.maxDistanceFromCentroidM,
      avgDistanceFromCentroidM: pocket.geometry.avgDistanceFromCentroidM,
      maxPairwiseDistanceM: pocket.geometry.maxPairwiseDistanceM,
      bboxWidthM: pocket.geometry.bboxWidthM,
      bboxHeightM: pocket.geometry.bboxHeightM,
      areaM2: pocket.geometry.areaM2,
      effectiveAreaM2ForDensity: pocket.geometry.effectiveAreaM2ForDensity,
      densityAreaFloorApplied: pocket.geometry.densityAreaFloorApplied,
      densityClamped: pocket.geometry.densityClamped,
      densityEntitiesPerKm2: pocket.geometry.densityEntitiesPerKm2
    },
    signals: {
      viabilityScore: pocket.viability.score,
      categoryDiversity: pocket.viability.signals.categoryDiversity,
      walkabilityScore: pocket.viability.signals.walkabilityScore,
      densityScore: pocket.viability.signals.densityScore,
      compactnessScore: pocket.viability.signals.compactnessScore,
      origin: pocket.origin,
      localSpecificityScore: profileByPocketId.get(pocket.id)?.hyperlocal?.localSpecificityScore
    },
    composition: buildCompositionSnapshot(pocket)
  }));
  return {
    enabled: true,
    pipelineSteps: [
      "resolveLocation",
      "fetchPlaceEntities",
      "formRawPockets",
      "applyPocketViabilityRules",
      "refinePocketsWithSplitMerge",
      "inferPocketIdentity",
      "assemblePocketProfiles",
      "rankAndSelectPockets",
      "buildDistrictDebugTrace"
    ],
    location: input.location,
    retrieval: input.retrieval,
    entityCount: input.entityCount,
    clustering: {
      primary: input.primaryClustering,
      fallback: input.fallbackClustering
    },
    pathFlags: input.pathFlags,
    pocketDiagnostics: {
      rawPocketCount: input.rawPockets.length,
      rawPocketSizes,
      viablePocketCount: input.viability.accepted.length,
      rejectedPocketCount: input.viability.rejected.length,
      rejectedPockets
    },
    stageNotes: input.stageNotes,
    pocketTraces,
    summary: [
      `Retrieval mode: ${input.retrieval.mode}. City: ${input.retrieval.city || "unknown"}. Selected entities: ${input.retrieval.selectedCount}.`,
      `Live attrition: raw ${input.retrieval.liveRawFetchedCount}, mapped ${input.retrieval.liveMappedCount}, normalized ${input.retrieval.liveNormalizedCount}, accepted ${input.retrieval.liveAcceptedCount}, suppressed ${input.retrieval.liveSuppressedCount}, bootstrap ${input.retrieval.bootstrapCount}.`,
      `Live drops: map ${input.retrieval.liveMappedDroppedCount} [${formatReasonBuckets(input.retrieval.liveMapDropReasons)}], normalize ${input.retrieval.liveNormalizationDroppedCount} [${formatReasonBuckets(input.retrieval.liveNormalizationDropReasons)}], suppression reasons [${formatReasonBuckets(input.retrieval.liveSuppressionReasons)}].`,
      `Geo spread: buckets ${input.retrieval.geoBucketCount}, dominant share ${input.retrieval.dominantAreaShare.toFixed(3)}, spread score ${input.retrieval.geoSpreadScore.toFixed(3)}, downsampled ${input.retrieval.geoDiversityDownsampledCount}.`,
      `Entities fetched: ${input.entityCount}.`,
      `Raw pockets: ${input.rawPockets.length}.`,
      `Raw pocket sizes: ${rawPocketSizeSummary}.`,
      `Viable pockets: ${input.viability.accepted.length}. Rejected pockets: ${input.viability.rejected.length}.`,
      `Refined pockets: ${input.refinedPockets.length}. Identified pockets: ${input.identifiedPockets.length}.`,
      `Profiles: ${input.profiles.length}. Ranked outputs: ${input.ranked.length}.`,
      `Fallback used: ${input.pathFlags.usedFallbackClustering}. Synthetic fallback used: ${input.pathFlags.usedSyntheticFallback}. Promoted reject used: ${input.pathFlags.usedPromotedReject}.`
    ]
  };
}

// src/domain/retrieval/computeLiveQualityFairness.ts
var emptyProfile = {
  supportRecoveryEligible: false,
  qualityBonus: 0,
  fitBonus: 0,
  genericRelief: 0,
  hoursGrace: 0,
  notes: []
};
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeValue(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function countMatches(values, candidates) {
  return candidates.filter((candidate) => values.has(normalizeValue(candidate))).length;
}
function computeLiveQualityFairness(venue) {
  if (venue.source.sourceOrigin !== "live") {
    return emptyProfile;
  }
  const normalizedSignals = /* @__PURE__ */ new Set([
    ...venue.tags.map(normalizeValue),
    ...venue.source.sourceTypes.map(normalizeValue),
    ...venue.source.sourceQueryLabel ? venue.source.sourceQueryLabel.split(/[^a-z0-9]+/i).map(normalizeValue).filter(Boolean) : []
  ]);
  const notes = [];
  const distinctiveSignals = countMatches(normalizedSignals, [
    "cocktails",
    "wine",
    "coffee",
    "espresso-bar",
    "tea-house",
    "brunch",
    "chef-led",
    "seasonal",
    "local",
    "artisan",
    "craft",
    "cozy",
    "intimate",
    "rooftop",
    "outdoor-seating",
    "quiet",
    "museum",
    "gallery",
    "historic",
    "park",
    "trail",
    "event",
    "discovery",
    "cultural"
  ]);
  const supportedCategory = venue.category === "restaurant" || venue.category === "bar" || venue.category === "cafe" || venue.category === "dessert" || venue.category === "museum" || venue.category === "activity" || venue.category === "park" || venue.category === "event";
  const supportFriendly = venue.category === "cafe" || venue.category === "restaurant" || venue.category === "dessert" || venue.category === "museum" || venue.category === "activity" || venue.category === "park" || venue.category === "event" || venue.category === "bar" && venue.settings.dateFriendly || venue.settings.supportOnly;
  const strongRecord = venue.source.sourceConfidence >= 0.56 && venue.source.completenessScore >= 0.56;
  const signatureFairness = clamp01(
    venue.signature.signatureScore * 0.34 + (1 - venue.signature.genericScore) * 0.24 + venue.source.sourceConfidence * 0.18 + venue.source.completenessScore * 0.14 + Math.min(distinctiveSignals, 4) * 0.04
  );
  const supportRecoveryEligible = supportedCategory && supportFriendly && strongRecord && !venue.signature.chainLike && !venue.source.hoursSuppressionApplied && (signatureFairness >= 0.56 || distinctiveSignals >= 2);
  if (supportRecoveryEligible) {
    notes.push("live support candidate has enough metadata to compete fairly");
  }
  if (distinctiveSignals >= 2) {
    notes.push("distinctive live metadata reduced genericity");
  }
  return {
    supportRecoveryEligible,
    qualityBonus: supportRecoveryEligible ? Number(Math.min(0.05, 0.012 + signatureFairness * 0.032).toFixed(3)) : 0,
    fitBonus: supportRecoveryEligible ? Number(Math.min(0.024, 6e-3 + signatureFairness * 0.016).toFixed(3)) : 0,
    genericRelief: supportRecoveryEligible ? Number(Math.min(0.1, 0.02 + Math.min(distinctiveSignals, 4) * 0.015).toFixed(3)) : 0,
    hoursGrace: supportRecoveryEligible && !venue.source.hoursKnown ? 0.018 : supportRecoveryEligible ? 8e-3 : 0,
    notes
  };
}

// src/domain/normalize/applyQualityGate.ts
function clamp012(value) {
  return Math.max(0, Math.min(1, value));
}
function meaningfulTagCount(venue) {
  return venue.tags.filter((tag) => tag.trim().length >= 4).length;
}
function hasAnySignal(venue, candidates) {
  const normalized = new Set(
    [...venue.tags, ...venue.source.sourceTypes].map((value) => value.trim().toLowerCase())
  );
  return candidates.some((candidate) => normalized.has(candidate.toLowerCase()));
}
function applyQualityGate(venue) {
  const notes = [];
  const approvalBlockers = [];
  const demotionReasons = [];
  const suppressionReasons = [];
  let status = "approved";
  let hoursDemotionApplied = false;
  let hoursSuppressionApplied = false;
  const tagCount = meaningfulTagCount(venue);
  const isLiveSource = venue.source.sourceOrigin === "live";
  const supportedLiveCategories = /* @__PURE__ */ new Set([
    "restaurant",
    "bar",
    "cafe",
    "dessert",
    "museum",
    "activity",
    "park",
    "event"
  ]);
  const nonCoreLiveCategory = venue.category !== "restaurant" && venue.category !== "bar" && venue.category !== "cafe";
  const unsupportedLiveCategory = isLiveSource && !supportedLiveCategories.has(venue.category);
  const fastFoodLike = hasAnySignal(venue, [
    "fast-food",
    "fast-food-restaurant",
    "meal-takeaway",
    "meal-delivery",
    "drive-through"
  ]);
  const convenienceLike = hasAnySignal(venue, [
    "convenience-store",
    "gas-station",
    "grocery-store",
    "supermarket"
  ]);
  const likelyClosedNow = !venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.7;
  const stronglyClosedNow = !venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.86;
  const highConfidenceOpenNow = venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.68;
  const liveFairness = computeLiveQualityFairness(venue);
  const supportApprovalCandidate = liveFairness.supportRecoveryEligible && venue.settings.highlightCapabilityTier !== "connective-only";
  const completenessPenalty = venue.source.missingFields.length * 0.07;
  const effectiveGenericScore = clamp012(venue.signature.genericScore - liveFairness.genericRelief);
  const effectiveSourceConfidence = clamp012(
    venue.source.sourceConfidence + (supportApprovalCandidate ? 0.03 : 0)
  );
  const genericPenalty = effectiveGenericScore * 0.32;
  const chainPenalty = venue.signature.chainLike ? 0.16 : 0;
  const hoursPenalty = isLiveSource && likelyClosedNow ? stronglyClosedNow ? Math.max(0.1, 0.18 - liveFairness.hoursGrace) : Math.max(0.03, 0.08 - liveFairness.hoursGrace) : isLiveSource && !venue.source.hoursKnown ? Math.max(4e-3, 0.025 - liveFairness.hoursGrace) : 0;
  const hoursBonus = isLiveSource && highConfidenceOpenNow ? 0.06 : 0;
  const completenessScore = clamp012(1 - completenessPenalty);
  const qualityScore = clamp012(
    effectiveSourceConfidence * 0.36 + completenessScore * 0.24 + venue.signature.signatureScore * 0.2 + (1 - effectiveGenericScore) * 0.12 + venue.settings.highlightConfidence * 0.08 + liveFairness.qualityBonus + hoursBonus - hoursPenalty - chainPenalty - genericPenalty
  );
  if (venue.signature.chainLike) {
    notes.push("chain-like profile");
  }
  if (effectiveGenericScore >= 0.64) {
    notes.push("generic venue signature");
  }
  if (tagCount < 2) {
    notes.push("thin descriptive tagging");
  }
  if (venue.source.missingFields.length > 2) {
    notes.push("source record is missing several engine fields");
  }
  if (venue.settings.supportOnly) {
    notes.push("support-shaped venue");
  }
  if (isLiveSource && nonCoreLiveCategory) {
    notes.push("extended live category candidate");
  }
  if (fastFoodLike) {
    notes.push("fast-food / takeaway signal");
  }
  if (convenienceLike) {
    notes.push("convenience signal");
  }
  if (isLiveSource && venue.source.hoursKnown) {
    notes.push(
      venue.source.likelyOpenForCurrentWindow ? "hours signal supports current planning window" : "hours signal conflicts with current planning window"
    );
  }
  if (isLiveSource && !venue.source.hoursKnown) {
    notes.push("hours are unknown for the current planning window");
  }
  for (const note of liveFairness.notes) {
    notes.push(note);
  }
  if (supportApprovalCandidate) {
    notes.push("live support candidate has a viable path to approval");
  }
  if (effectiveSourceConfidence < 0.36 && venue.source.missingFields.length >= 3 && venue.settings.highlightCapabilityTier !== "highlight-capable") {
    suppressionReasons.push("low-confidence record with weak completeness");
  }
  if (venue.signature.chainLike && effectiveGenericScore >= 0.78 && venue.settings.highlightCapabilityTier !== "highlight-capable") {
    suppressionReasons.push("generic chain-like venue is too low-signal for current inventory");
  }
  if (tagCount < 2 && venue.shortDescription.trim().length < 28 && venue.settings.highlightCapabilityTier === "connective-only") {
    suppressionReasons.push("too little descriptive signal to normalize reliably");
  }
  if (unsupportedLiveCategory) {
    suppressionReasons.push("unsupported category for live place ingestion");
  }
  if (isLiveSource && nonCoreLiveCategory && venue.source.sourceConfidence < 0.53 && venue.source.completenessScore < 0.55 && venue.settings.highlightCapabilityTier === "connective-only") {
    suppressionReasons.push("extended live category lacked minimum confidence and completeness");
  }
  if (isLiveSource && (venue.source.businessStatus === "temporarily-closed" || venue.source.businessStatus === "closed-permanently")) {
    suppressionReasons.push(`live venue is ${venue.source.businessStatus}`);
    hoursSuppressionApplied = true;
  }
  if (isLiveSource && stronglyClosedNow && venue.settings.highlightCapabilityTier === "highlight-capable") {
    suppressionReasons.push("live highlight-capable venue appears closed for the current planning window");
    hoursSuppressionApplied = true;
  }
  if (isLiveSource && (fastFoodLike || convenienceLike)) {
    suppressionReasons.push("unsupported low-signal place type for live restaurant/bar/cafe ingestion");
  }
  if (isLiveSource && effectiveGenericScore >= 0.8 && effectiveSourceConfidence < 0.56 && venue.settings.highlightCapabilityTier !== "highlight-capable" && !liveFairness.supportRecoveryEligible) {
    suppressionReasons.push("live venue is too generic for the current engine slice");
  }
  if (suppressionReasons.length > 0) {
    status = "suppressed";
    approvalBlockers.push(...suppressionReasons);
  } else {
    if (qualityScore < (supportApprovalCandidate ? 0.54 : 0.62)) {
      demotionReasons.push("quality score stayed below the approval floor");
    }
    if (effectiveGenericScore >= (supportApprovalCandidate ? 0.68 : 0.6)) {
      demotionReasons.push("generic signature kept the venue below approval");
    }
    if (effectiveSourceConfidence < (supportApprovalCandidate ? 0.5 : 0.55)) {
      demotionReasons.push("source confidence stayed below the approval floor");
    }
    if (isLiveSource && likelyClosedNow && venue.settings.highlightCapabilityTier !== "connective-only") {
      demotionReasons.push("hours signal stayed too soft for confident approval");
    }
    if (isLiveSource && !venue.source.hoursKnown && effectiveGenericScore >= (supportApprovalCandidate ? 0.72 : 0.64) && venue.settings.highlightCapabilityTier !== "highlight-capable" && !liveFairness.supportRecoveryEligible) {
      demotionReasons.push("unknown hours kept a generic live venue below approval");
    }
    if (isLiveSource && effectiveGenericScore >= (supportApprovalCandidate ? 0.72 : 0.68) && effectiveSourceConfidence < (supportApprovalCandidate ? 0.62 : 0.7) && !liveFairness.supportRecoveryEligible) {
      demotionReasons.push("generic live metadata still outweighed trust signals");
    }
    if (venue.settings.supportOnly && effectiveGenericScore >= (supportApprovalCandidate ? 0.62 : 0.52) && venue.settings.highlightConfidence < (supportApprovalCandidate ? 0.54 : 0.6)) {
      demotionReasons.push("support-shaped venue still lacked enough signature to approve outright");
    }
  }
  if (demotionReasons.length > 0) {
    status = "demoted";
    approvalBlockers.push(...demotionReasons);
    hoursDemotionApplied = hoursDemotionApplied || isLiveSource && (likelyClosedNow && venue.settings.highlightCapabilityTier !== "connective-only" || !venue.source.hoursKnown && effectiveGenericScore >= 0.58 && venue.settings.highlightCapabilityTier !== "highlight-capable");
  }
  return {
    status,
    qualityScore: Number(qualityScore.toFixed(2)),
    notes: [...new Set(notes)],
    approvalBlockers: [...new Set(approvalBlockers)],
    demotionReasons: [...new Set(demotionReasons)],
    suppressionReasons,
    hoursDemotionApplied,
    hoursSuppressionApplied
  };
}

// src/domain/normalize/deriveVenueHappeningsSignals.ts
function clamp013(value) {
  return Math.max(0, Math.min(1, value));
}
function toFixed01(value) {
  return Number(clamp013(value).toFixed(3));
}
function normalizeToken(value) {
  return value.trim().toLowerCase();
}
function collectNormalizedTokens(venue) {
  const summary = `${venue.shortDescription} ${venue.narrativeFlavor} ${venue.subcategory}`.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ");
  return new Set(
    [...venue.tags, ...venue.vibeTags, ...venue.source.sourceTypes, ...summary.split(/\s+/)].map(normalizeToken).filter(Boolean)
  );
}
function hasAnyToken(tokens, candidates) {
  return candidates.some((candidate) => tokens.has(candidate));
}
function getCategoryBase(venue, values, fallback) {
  return values[venue.category] ?? fallback;
}
function deriveVenueHappeningsSignals(venue) {
  const tokens = collectNormalizedTokens(venue);
  const eventLikeSignal = (venue.settings.eventCapable ? 0.14 : 0) + (venue.settings.performanceCapable ? 0.12 : 0) + (venue.settings.musicCapable ? 0.1 : 0);
  const currentOpenSignal = venue.source.openNow ? 0.12 : venue.source.likelyOpenForCurrentWindow ? 0.08 : 0;
  const highQualitySignal = venue.signature.signatureScore * 0.08 + venue.source.qualityScore * 0.06 + venue.source.sourceConfidence * 0.05;
  const hotspotStrength = toFixed01(
    getCategoryBase(
      venue,
      {
        bar: 0.68,
        live_music: 0.72,
        event: 0.66,
        restaurant: 0.56,
        activity: 0.54,
        museum: 0.46,
        cafe: 0.42,
        park: 0.34,
        dessert: 0.36
      },
      0.45
    ) + venue.energyLevel / 5 * 0.14 + venue.socialDensity / 5 * 0.1 + venue.shareabilityScore * 0.08 + (hasAnyToken(tokens, ["nightlife", "social", "crowded", "district", "market"]) ? 0.08 : 0) + highQualitySignal
  );
  const eventPotential = toFixed01(
    getCategoryBase(
      venue,
      {
        event: 0.82,
        live_music: 0.72,
        activity: 0.5,
        museum: 0.42,
        bar: 0.38
      },
      0.28
    ) + eventLikeSignal + (hasAnyToken(tokens, [
      "event",
      "festival",
      "market",
      "community",
      "popup",
      "program",
      "lineup",
      "showcase"
    ]) ? 0.1 : 0) + currentOpenSignal * 0.45
  );
  const performancePotential = toFixed01(
    getCategoryBase(
      venue,
      {
        live_music: 0.84,
        event: 0.64,
        museum: 0.46,
        activity: 0.44,
        bar: 0.34
      },
      0.22
    ) + (venue.settings.performanceCapable ? 0.14 : 0) + (venue.settings.musicCapable ? 0.14 : 0) + (hasAnyToken(tokens, [
      "live",
      "music",
      "jazz",
      "concert",
      "performance",
      "theatre",
      "theater",
      "opera",
      "stage"
    ]) ? 0.12 : 0)
  );
  const liveNightlifePotential = toFixed01(
    getCategoryBase(
      venue,
      {
        bar: 0.84,
        live_music: 0.78,
        event: 0.58,
        restaurant: 0.36,
        activity: 0.34
      },
      0.2
    ) + venue.energyLevel / 5 * 0.12 + venue.socialDensity / 5 * 0.08 + (hasAnyToken(tokens, [
      "late",
      "night",
      "nightcap",
      "cocktail",
      "speakeasy",
      "lounge",
      "after",
      "midnight"
    ]) ? 0.14 : 0) + currentOpenSignal
  );
  const culturalAnchorPotential = toFixed01(
    getCategoryBase(
      venue,
      {
        museum: 0.82,
        event: 0.58,
        activity: 0.56,
        live_music: 0.5,
        park: 0.42,
        restaurant: 0.38,
        bar: 0.32
      },
      0.28
    ) + venue.distinctivenessScore * 0.14 + venue.uniquenessScore * 0.08 + (hasAnyToken(tokens, [
      "museum",
      "gallery",
      "cultural",
      "historic",
      "theatre",
      "theater",
      "opera",
      "heritage"
    ]) ? 0.16 : 0)
  );
  const lateNightPotential = toFixed01(
    getCategoryBase(
      venue,
      {
        bar: 0.74,
        live_music: 0.66,
        event: 0.58,
        restaurant: 0.38,
        dessert: 0.32
      },
      0.24
    ) + (hasAnyToken(tokens, [
      "late",
      "night",
      "nightcap",
      "after",
      "midnight",
      "open"
    ]) ? 0.16 : 0) + (venue.source.hoursPressureLevel === "strong-open" ? 0.1 : 0) + (venue.source.hoursPressureLevel === "likely-open" ? 0.05 : 0) + venue.source.timeConfidence * 0.06
  );
  const currentRelevance = toFixed01(
    0.22 + (venue.source.openNow ? 0.28 : 0) + (venue.source.likelyOpenForCurrentWindow ? 0.16 : 0) + venue.source.timeConfidence * 0.18 + eventPotential * 0.08 + performancePotential * 0.08 + (venue.source.businessStatus === "operational" ? 0.08 : 0)
  );
  const hiddenGemStrength = toFixed01(
    (venue.isHiddenGem ? 0.48 : 0.16) + venue.underexposureScore * 0.22 + venue.distinctivenessScore * 0.14 + venue.localSignals.localFavoriteScore * 0.1
  );
  const majorVenueStrength = toFixed01(
    getCategoryBase(
      venue,
      {
        museum: 0.46,
        event: 0.44,
        live_music: 0.4
      },
      0.22
    ) + venue.signature.signatureScore * 0.16 + venue.distinctivenessScore * 0.1 + (hasAnyToken(tokens, [
      "arena",
      "stadium",
      "theatre",
      "theater",
      "opera",
      "museum",
      "center",
      "centre",
      "hall",
      "district"
    ]) ? 0.16 : 0)
  );
  return {
    hotspotStrength,
    eventPotential,
    performancePotential,
    liveNightlifePotential,
    culturalAnchorPotential,
    lateNightPotential,
    currentRelevance,
    hiddenGemStrength,
    majorVenueStrength
  };
}

// src/domain/normalize/getNormalizedCategory.ts
function normalizeValue2(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function firstMatch(values, candidates) {
  return values.find((value) => candidates.includes(value));
}
function firstSuffixMatch(values, suffix) {
  return values.find((value) => value.endsWith(suffix));
}
function getNormalizedCategory(raw) {
  if (raw.categoryHint) {
    return {
      category: raw.categoryHint,
      subcategory: raw.subcategoryHint ?? raw.categoryHint
    };
  }
  const rawTypes = [
    ...raw.rawType === "place" ? raw.placeTypes ?? [] : raw.eventTypes ?? [],
    ...raw.sourceTypes ?? [],
    ...raw.tags ?? []
  ].map(normalizeValue2);
  const dessertType = firstMatch(rawTypes, ["dessert", "bakery", "ice-cream", "gelato", "pastry"]);
  if (dessertType) {
    return { category: "dessert", subcategory: dessertType };
  }
  const cafeType = firstMatch(rawTypes, [
    "cafe",
    "coffee",
    "coffee-shop",
    "tea-room",
    "tea-house",
    "espresso-bar"
  ]);
  if (cafeType) {
    return { category: "cafe", subcategory: cafeType };
  }
  const barType = firstMatch(rawTypes, [
    "bar",
    "cocktail-bar",
    "wine-bar",
    "lounge",
    "brewery",
    "winery",
    "pub",
    "beer-hall",
    "sports-bar"
  ]);
  if (barType) {
    return { category: "bar", subcategory: barType };
  }
  const musicType = firstMatch(rawTypes, ["live_music", "music-venue", "concert", "performance", "small-stage"]);
  if (musicType) {
    return { category: "live_music", subcategory: musicType };
  }
  const museumType = firstMatch(rawTypes, ["museum", "gallery", "exhibit"]);
  if (museumType) {
    return { category: "museum", subcategory: museumType };
  }
  const parkType = firstMatch(rawTypes, ["park", "garden", "trail", "viewpoint", "greenhouse"]);
  if (parkType) {
    return { category: "park", subcategory: parkType };
  }
  const activityType = firstMatch(rawTypes, [
    "activity",
    "arcade",
    "games",
    "board-games",
    "karaoke",
    "mini-golf",
    "studio",
    "guided",
    "photo-walk"
  ]);
  if (activityType) {
    return { category: "activity", subcategory: activityType };
  }
  const eventType = firstMatch(rawTypes, [
    "event",
    "market",
    "festival",
    "fair",
    "pop-up",
    "gallery-crawl",
    "observatory",
    "stargazing"
  ]);
  if (eventType || raw.rawType === "event") {
    return { category: "event", subcategory: eventType ?? "event" };
  }
  const restaurantType = firstMatch(rawTypes, ["restaurant", "food", "tapas", "bistro", "food-hall"]) ?? firstSuffixMatch(rawTypes, "-restaurant");
  return {
    category: "restaurant",
    subcategory: restaurantType ?? "restaurant"
  };
}

// src/domain/normalize/inferHoursPressure.ts
function clamp014(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeValue3(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function hasAny(values, candidates) {
  return candidates.some((candidate) => values.includes(candidate));
}
function toWeeklyMinute(day, hour, minute) {
  return day * 24 * 60 + hour * 60 + minute;
}
function mapBusinessStatus(value) {
  const normalized = value ? normalizeValue3(value) : "unknown";
  if (normalized === "operational") {
    return "operational";
  }
  if (normalized === "closed-temporarily" || normalized === "temporarily-closed") {
    return "temporarily-closed";
  }
  if (normalized === "closed-permanently") {
    return "closed-permanently";
  }
  return "unknown";
}
function isOpenDuringWindow(periods, signal) {
  if (!periods || periods.length === 0) {
    return void 0;
  }
  const targetMinute = toWeeklyMinute(signal.day, signal.hour, signal.minute);
  for (const period of periods) {
    if (!period.open || !period.close) {
      continue;
    }
    let openMinute = toWeeklyMinute(period.open.day, period.open.hour, period.open.minute);
    let closeMinute = toWeeklyMinute(period.close.day, period.close.hour, period.close.minute);
    if (closeMinute <= openMinute) {
      closeMinute += 7 * 24 * 60;
    }
    const adjustedTarget = targetMinute < openMinute ? targetMinute + 7 * 24 * 60 : targetMinute;
    if (adjustedTarget >= openMinute && adjustedTarget < closeMinute) {
      return true;
    }
  }
  return false;
}
function inferLikelyOpenFromCategory(raw, category, signal) {
  const notes = [];
  const placeSignals = [
    ...raw.placeTypes ?? [],
    ...raw.sourceTypes ?? [],
    ...raw.tags ?? []
  ].map(normalizeValue3);
  if (category === "cafe") {
    if (signal.phase === "morning") {
      return { likelyOpen: true, confidence: 0.58, notes: ["cafe-hour heuristic favors mornings"] };
    }
    if (signal.phase === "afternoon") {
      return { likelyOpen: true, confidence: 0.54, notes: ["cafe-hour heuristic still supports afternoons"] };
    }
    if (signal.phase === "evening") {
      const eveningCafe = hasAny(placeSignals, ["dessert", "tea-house", "intimate", "late-night"]);
      return {
        likelyOpen: eveningCafe,
        confidence: eveningCafe ? 0.46 : 0.5,
        notes: [eveningCafe ? "evening cafe signal detected" : "cafe-hour heuristic weak after daytime"]
      };
    }
    return {
      likelyOpen: hasAny(placeSignals, ["late-night", "dessert"]),
      confidence: hasAny(placeSignals, ["late-night", "dessert"]) ? 0.56 : 0.58,
      notes: ["late-night cafe heuristic is conservative"]
    };
  }
  if (category === "bar") {
    if (signal.phase === "morning") {
      return { likelyOpen: false, confidence: 0.78, notes: ["bar-hour heuristic suppresses morning anchors"] };
    }
    if (signal.phase === "afternoon") {
      const afternoonBar = hasAny(placeSignals, ["brewery", "sports-bar", "beer-hall"]);
      return {
        likelyOpen: afternoonBar,
        confidence: afternoonBar ? 0.52 : 0.56,
        notes: [afternoonBar ? "afternoon bar subtype detected" : "bar-hour heuristic prefers later windows"]
      };
    }
    return {
      likelyOpen: true,
      confidence: signal.phase === "late-night" ? 0.66 : 0.6,
      notes: ["bar-hour heuristic supports evening nightlife windows"]
    };
  }
  if (signal.phase === "morning") {
    const brunchFriendly = hasAny(placeSignals, ["breakfast", "brunch", "coffee"]);
    return {
      likelyOpen: brunchFriendly,
      confidence: brunchFriendly ? 0.56 : 0.5,
      notes: [brunchFriendly ? "morning restaurant subtype detected" : "restaurant-hour heuristic is weaker in the morning"]
    };
  }
  if (signal.phase === "late-night") {
    const lateNightFriendly = hasAny(placeSignals, ["late-night", "cocktails", "bar"]);
    return {
      likelyOpen: lateNightFriendly,
      confidence: lateNightFriendly ? 0.52 : 0.52,
      notes: [lateNightFriendly ? "late-night restaurant signal detected" : "restaurant-hour heuristic softens after late night"]
    };
  }
  notes.push(signal.phase === "evening" ? "restaurant-hour heuristic favors dinner windows" : "restaurant-hour heuristic supports daytime service");
  return {
    likelyOpen: true,
    confidence: signal.phase === "evening" ? 0.58 : 0.54,
    notes
  };
}
function inferHoursPressure({
  raw,
  category,
  timeWindowSignal
}) {
  const businessStatus = mapBusinessStatus(raw.businessStatus);
  const isLive = raw.sourceOrigin === "live";
  if (!isLive) {
    return {
      openNow: void 0,
      hoursKnown: false,
      likelyOpenForCurrentWindow: true,
      businessStatus,
      timeConfidence: 0.24,
      hoursPressureLevel: "unknown",
      hoursPressureNotes: ["Curated venue has no live hours metadata in this phase."]
    };
  }
  if (businessStatus === "closed-permanently" || businessStatus === "temporarily-closed") {
    return {
      openNow: false,
      hoursKnown: true,
      likelyOpenForCurrentWindow: false,
      businessStatus,
      timeConfidence: 1,
      hoursPressureLevel: "closed",
      hoursPressureNotes: [`Business status is ${businessStatus}.`]
    };
  }
  const hoursKnown = Boolean(
    typeof raw.openNow === "boolean" || raw.hoursPeriods && raw.hoursPeriods.length > 0 || raw.currentOpeningHoursText && raw.currentOpeningHoursText.length > 0 || raw.regularOpeningHoursText && raw.regularOpeningHoursText.length > 0
  );
  if (typeof raw.openNow === "boolean") {
    if (timeWindowSignal?.usesIntentWindow) {
      const heuristic2 = inferLikelyOpenFromCategory(raw, category, timeWindowSignal);
      const confidence = clamp014(
        heuristic2.confidence + (raw.openNow ? 0.1 : -0.02) + ((raw.hoursPeriods?.length ?? 0) > 0 ? 0.06 : 0)
      );
      return {
        openNow: raw.openNow,
        hoursKnown: true,
        likelyOpenForCurrentWindow: heuristic2.likelyOpen,
        businessStatus,
        timeConfidence: Number(confidence.toFixed(2)),
        hoursPressureLevel: heuristic2.likelyOpen ? "likely-open" : "likely-closed",
        hoursPressureNotes: [
          ...heuristic2.notes,
          raw.openNow ? "Provider reports open now, but a future/planned window required heuristic calibration." : "Provider reports closed now, but the requested planning window required softer heuristic calibration."
        ]
      };
    }
    return {
      openNow: raw.openNow,
      hoursKnown: true,
      likelyOpenForCurrentWindow: raw.openNow,
      businessStatus,
      timeConfidence: raw.openNow ? 0.96 : 0.94,
      hoursPressureLevel: raw.openNow ? "strong-open" : "closed",
      hoursPressureNotes: [raw.openNow ? "Provider reports open now." : "Provider reports closed now."]
    };
  }
  if (timeWindowSignal && raw.hoursPeriods && raw.hoursPeriods.length > 0) {
    const openFromPeriods = isOpenDuringWindow(raw.hoursPeriods, timeWindowSignal);
    if (typeof openFromPeriods === "boolean") {
      return {
        openNow: void 0,
        hoursKnown: true,
        likelyOpenForCurrentWindow: openFromPeriods,
        businessStatus,
        timeConfidence: 0.88,
        hoursPressureLevel: openFromPeriods ? "strong-open" : "likely-closed",
        hoursPressureNotes: [
          openFromPeriods ? `Opening periods suggest the venue is available for ${timeWindowSignal.label}.` : `Opening periods suggest the venue is not available for ${timeWindowSignal.label}.`
        ]
      };
    }
  }
  if (!timeWindowSignal) {
    return {
      openNow: void 0,
      hoursKnown,
      likelyOpenForCurrentWindow: true,
      businessStatus,
      timeConfidence: hoursKnown ? 0.56 : 0.38,
      hoursPressureLevel: hoursKnown ? "likely-open" : "unknown",
      hoursPressureNotes: [
        hoursKnown ? "Hours metadata exists, but no current planning window was available." : "No hours metadata was available from the live provider."
      ]
    };
  }
  const heuristic = inferLikelyOpenFromCategory(raw, category, timeWindowSignal);
  const softenedConfidence = clamp014(
    heuristic.confidence + (hoursKnown ? 0.04 : heuristic.likelyOpen ? 0.02 : -0.08)
  );
  return {
    openNow: void 0,
    hoursKnown,
    likelyOpenForCurrentWindow: heuristic.likelyOpen,
    businessStatus,
    timeConfidence: Number(softenedConfidence.toFixed(2)),
    hoursPressureLevel: !hoursKnown ? heuristic.likelyOpen || softenedConfidence < 0.64 ? "unknown" : "likely-closed" : heuristic.likelyOpen ? "likely-open" : "likely-closed",
    hoursPressureNotes: [
      ...heuristic.notes,
      hoursKnown ? `Hours metadata exists but required heuristic interpretation for ${timeWindowSignal.label}.` : `No structured hours were returned, so a ${timeWindowSignal.label} heuristic was used.`
    ]
  };
}

// src/domain/taste/getDurationProfile.ts
var categoryProfiles = {
  dessert: { durationClass: "XS", minMinutes: 15, maxMinutes: 35, baseMinutes: 25 },
  cafe: { durationClass: "S", minMinutes: 30, maxMinutes: 65, baseMinutes: 45 },
  bar: { durationClass: "M", minMinutes: 45, maxMinutes: 95, baseMinutes: 75 },
  restaurant: { durationClass: "L", minMinutes: 75, maxMinutes: 150, baseMinutes: 110 },
  museum: { durationClass: "L", minMinutes: 75, maxMinutes: 140, baseMinutes: 100 },
  live_music: { durationClass: "XL", minMinutes: 110, maxMinutes: 180, baseMinutes: 140 },
  park: { durationClass: "S", minMinutes: 30, maxMinutes: 100, baseMinutes: 50 },
  activity: { durationClass: "M", minMinutes: 45, maxMinutes: 120, baseMinutes: 80 },
  event: { durationClass: "M", minMinutes: 45, maxMinutes: 120, baseMinutes: 85 }
};
function getDurationClass(minutes) {
  if (minutes <= 30) {
    return "XS";
  }
  if (minutes <= 60) {
    return "S";
  }
  if (minutes <= 90) {
    return "M";
  }
  if (minutes <= 150) {
    return "L";
  }
  return "XL";
}
function getDurationProfile(venue) {
  const tags = new Set(venue.tags.map((tag) => tag.toLowerCase()));
  const profile = categoryProfiles[venue.category];
  let baseMinutes = profile.baseMinutes;
  if (tags.has("quick-start") || tags.has("walk-up")) {
    baseMinutes -= 10;
  }
  if (tags.has("chef-led") || tags.has("elevated") || tags.has("tasting-menu") || tags.has("wine-pairing")) {
    baseMinutes += 20;
  }
  if (tags.has("social") || tags.has("rooftop") || tags.has("beer-garden")) {
    baseMinutes += 10;
  }
  if (tags.has("tea-room") || tags.has("quiet") || tags.has("reflective") || tags.has("garden")) {
    baseMinutes += 10;
  }
  if (tags.has("trail") || tags.has("viewpoint") || tags.has("nature")) {
    baseMinutes += 25;
  }
  if (tags.has("arcade") || tags.has("games") || tags.has("mini-golf") || tags.has("karaoke")) {
    baseMinutes += 15;
  }
  if (tags.has("hands-on") || tags.has("immersive") || tags.has("guided") || tags.has("learning") || tags.has("family-friendly")) {
    baseMinutes += 10;
  }
  if (tags.has("local-artists") || tags.has("small-stage") || tags.has("listening") || tags.has("jazz") || tags.has("acoustic")) {
    baseMinutes += 15;
  }
  if (tags.has("market") || tags.has("makers") || tags.has("gallery") || tags.has("vintage") || tags.has("pop-up")) {
    baseMinutes -= 10;
  }
  if (tags.has("dessert") || tags.has("gelato") || tags.has("ice-cream")) {
    baseMinutes -= 10;
  }
  const estimatedDurationMinutes = Math.max(profile.minMinutes, Math.min(profile.maxMinutes, baseMinutes));
  return {
    durationClass: getDurationClass(estimatedDurationMinutes),
    minMinutes: profile.minMinutes,
    maxMinutes: profile.maxMinutes,
    baseMinutes: estimatedDurationMinutes
  };
}

// src/domain/retrieval/computeLiveSignatureStrength.ts
var emptyStrength = {
  strength: 0,
  signatureBoost: 0,
  genericRelief: 0,
  sourceConfidenceBoost: 0,
  notes: []
};
function clamp015(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeValue4(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function tokenizeQueryLabel(value) {
  if (!value) {
    return [];
  }
  return value.split(/[^a-z0-9]+/i).map((part) => normalizeValue4(part)).filter(Boolean);
}
function countMatches2(values, candidates) {
  return candidates.filter((candidate) => values.has(normalizeValue4(candidate))).length;
}
function computeLiveSignatureStrength(raw, category) {
  if (raw.sourceOrigin !== "live") {
    return emptyStrength;
  }
  const normalizedSignals = /* @__PURE__ */ new Set([
    ...(raw.tags ?? []).map(normalizeValue4),
    ...(raw.sourceTypes ?? []).map(normalizeValue4),
    ...(raw.queryTerms ?? []).map(normalizeValue4),
    ...tokenizeQueryLabel(raw.sourceQueryLabel)
  ]);
  const notes = [];
  const distinctiveSignals = countMatches2(normalizedSignals, [
    "cocktails",
    "cocktail-bar",
    "wine",
    "wine-bar",
    "espresso-bar",
    "tea-house",
    "brunch",
    "chef-led",
    "seasonal",
    "local",
    "artisan",
    "craft",
    "cozy",
    "intimate",
    "rooftop",
    "outdoor-seating",
    "historic",
    "understated"
  ]);
  const categorySpecificSignals = category === "bar" ? countMatches2(normalizedSignals, ["cocktails", "wine", "rooftop", "brewery", "craft", "intimate"]) : category === "cafe" ? countMatches2(normalizedSignals, ["espresso-bar", "tea-house", "cozy", "artisan", "local"]) : countMatches2(normalizedSignals, ["chef-led", "seasonal", "brunch", "local", "craft", "intimate"]);
  const rating = raw.rating ?? 0;
  const ratingCount = raw.ratingCount ?? 0;
  const reviewSignal = (rating >= 4.6 ? 0.12 : rating >= 4.4 ? 0.08 : rating >= 4.2 ? 0.04 : 0) + (ratingCount >= 800 ? 0.1 : ratingCount >= 250 ? 0.07 : ratingCount >= 80 ? 0.04 : 0);
  const summarySignal = raw.shortDescription && raw.shortDescription.trim().length >= 36 ? 0.06 : raw.shortDescription && raw.shortDescription.trim().length >= 20 ? 0.03 : 0;
  const querySignal = categorySpecificSignals >= 1 && (raw.queryTerms?.length ?? 0) > 0 ? 0.04 : 0;
  const localSignal = distinctiveSignals >= 2 ? 0.06 : distinctiveSignals === 1 ? 0.03 : 0;
  const chainPenalty = raw.isChain ? 0.12 : 0;
  const strength = clamp015(
    0.26 + reviewSignal + summarySignal + querySignal + localSignal + Math.min(categorySpecificSignals, 3) * 0.06 - chainPenalty
  );
  if (reviewSignal >= 0.08) {
    notes.push("reviews imply stronger local signal");
  }
  if (categorySpecificSignals >= 1) {
    notes.push("category-specific signature cues detected");
  }
  if (querySignal > 0) {
    notes.push("query intent aligns with venue signature");
  }
  return {
    strength: Number(strength.toFixed(2)),
    signatureBoost: Number(Math.min(0.16, strength * 0.14).toFixed(2)),
    genericRelief: Number(Math.min(0.14, strength * 0.12).toFixed(2)),
    sourceConfidenceBoost: Number(Math.min(0.06, strength * 0.05).toFixed(2)),
    notes
  };
}

// src/domain/normalize/inferVenueSignals.ts
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function hasAnyTag(raw, candidates) {
  const tags = new Set((raw.tags ?? []).map((tag) => tag.toLowerCase()));
  return candidates.some((candidate) => tags.has(candidate.toLowerCase()));
}
function inferSetting(raw, category) {
  if (raw.settingHint) {
    return raw.settingHint;
  }
  if (category === "park") {
    return "outdoor";
  }
  if (hasAnyTag(raw, ["garden", "trail", "viewpoint", "stargazing", "walkable", "outdoor-seating", "rooftop"])) {
    return category === "bar" || category === "event" || category === "activity" ? "hybrid" : "outdoor";
  }
  if (hasAnyTag(raw, ["greenhouse", "courtyard", "open-air"])) {
    return "hybrid";
  }
  return "indoor";
}
function inferEnergyLevel(raw, category, inferredFields) {
  if (typeof raw.energyLevel === "number") {
    return raw.energyLevel;
  }
  inferredFields.push("energyLevel");
  const baseByCategory = {
    restaurant: 3,
    bar: 4,
    cafe: 2,
    dessert: 2,
    live_music: 4,
    activity: 4,
    park: 1,
    museum: 2,
    event: 3
  };
  let energy = baseByCategory[category];
  if (hasAnyTag(raw, ["quiet", "calm", "tea-room", "reflective", "stargazing"])) {
    energy -= 1;
  }
  if (hasAnyTag(raw, ["social", "group", "arcade", "karaoke", "high-energy", "cocktails"])) {
    energy += 1;
  }
  return clamp2(energy, 1, 5);
}
function inferSocialDensity(raw, category, energyLevel, inferredFields) {
  if (typeof raw.socialDensity === "number") {
    return raw.socialDensity;
  }
  inferredFields.push("socialDensity");
  let socialDensity = category === "bar" || category === "event" || category === "live_music" ? 4 : category === "restaurant" || category === "activity" ? 3 : 2;
  if (hasAnyTag(raw, ["quiet", "tea-room", "reflective", "stroll"])) {
    socialDensity -= 1;
  }
  if (hasAnyTag(raw, ["community", "market", "social", "group"])) {
    socialDensity += 1;
  }
  if (energyLevel >= 4) {
    socialDensity += 0.5;
  }
  return clamp2(Math.round(socialDensity), 1, 5);
}
function inferVibeTags(raw, category, inferredFields) {
  if (raw.vibeTags && raw.vibeTags.length > 0) {
    return raw.vibeTags;
  }
  inferredFields.push("vibeTags");
  const base = {
    restaurant: ["culinary", "cozy"],
    bar: ["lively", "creative"],
    cafe: ["cozy", "relaxed"],
    dessert: ["cozy", "culinary"],
    live_music: ["culture", "creative"],
    activity: ["playful", "creative"],
    park: ["outdoors", "relaxed"],
    museum: ["culture", "creative"],
    event: ["creative", "culture"]
  };
  const vibes = new Set(base[category]);
  if (hasAnyTag(raw, ["social", "cocktails", "group", "community"])) {
    vibes.add("lively");
  }
  if (hasAnyTag(raw, ["quiet", "tea-room", "calm", "reflective"])) {
    vibes.add("relaxed");
  }
  if (hasAnyTag(raw, ["garden", "trail", "viewpoint", "stargazing"])) {
    vibes.add("outdoors");
  }
  return [...vibes];
}
function inferAudienceFlags(raw, category) {
  const familyFriendly = raw.familyFriendly ?? (hasAnyTag(raw, ["family-friendly", "learning", "hands-on", "outdoor-play", "animals"]) || category === "museum");
  const adultSocial = raw.adultSocial ?? (category === "bar" || category === "live_music" || hasAnyTag(raw, ["cocktails", "wine", "stylish", "rooftop", "speakeasy"]));
  const dateFriendly = raw.dateFriendly ?? (category === "restaurant" || category === "dessert" || hasAnyTag(raw, ["intimate", "chef-led", "tea-room", "cozy", "wine"]));
  return {
    familyFriendly,
    adultSocial,
    dateFriendly
  };
}
function inferUseCases(raw, audienceFlags, inferredFields) {
  if (raw.useCases && raw.useCases.length > 0) {
    return raw.useCases;
  }
  inferredFields.push("useCases");
  const useCases = /* @__PURE__ */ new Set();
  if (audienceFlags.dateFriendly) {
    useCases.add("romantic");
  }
  if (audienceFlags.adultSocial || hasAnyTag(raw, ["social", "group", "playful"])) {
    useCases.add("socialite");
  }
  if (audienceFlags.familyFriendly || hasAnyTag(raw, ["culture", "learning", "guided"])) {
    useCases.add("curator");
  }
  if (useCases.size === 0) {
    useCases.add("socialite");
  }
  return [...useCases];
}
function inferHighlightTier(raw, category) {
  if (category === "restaurant" || category === "bar" || category === "live_music") {
    return { tier: "highlight-capable", confidence: 0.82 };
  }
  if (category === "event" || category === "activity" && hasAnyTag(raw, ["arcade", "karaoke", "mini-golf", "guided"])) {
    return { tier: "highlight-capable", confidence: 0.74 };
  }
  if (category === "museum" || category === "activity" || category === "park" || category === "dessert" || category === "cafe") {
    return {
      tier: hasAnyTag(raw, ["scenic", "trail", "viewpoint", "signature", "historic", "immersive", "intimate"]) ? "highlight-capable" : "support-only",
      confidence: hasAnyTag(raw, ["signature", "immersive", "historic"]) ? 0.68 : 0.56
    };
  }
  return { tier: "connective-only", confidence: 0.45 };
}
function inferRouteFootprint(raw) {
  const driveMinutes = raw.driveMinutes ?? 12;
  if (driveMinutes <= 10) {
    return "compact";
  }
  if (driveMinutes <= 16) {
    return "neighborhood-hop";
  }
  return "destination";
}
function inferSignatureSignals(raw, category) {
  const chainLike = raw.isChain ?? false;
  const liveSignatureStrength = computeLiveSignatureStrength(raw, category);
  let genericScore = chainLike ? 0.8 : 0.32;
  let signatureScore = typeof raw.distinctivenessScore === "number" ? raw.distinctivenessScore : chainLike ? 0.28 : 0.62;
  if (hasAnyTag(raw, ["local", "signature", "chef-led", "historic", "artisan", "understated"])) {
    genericScore -= 0.12;
    signatureScore += 0.12;
  }
  if (hasAnyTag(raw, ["casual", "food-hall", "family-friendly", "neighborhood"])) {
    genericScore += 0.08;
  }
  if (category === "event" || category === "live_music") {
    signatureScore += 0.05;
  }
  if (liveSignatureStrength.strength > 0) {
    genericScore -= liveSignatureStrength.genericRelief;
    signatureScore += liveSignatureStrength.signatureBoost;
  }
  return {
    chainLike,
    genericScore: clamp2(Number(genericScore.toFixed(2)), 0, 1),
    signatureScore: clamp2(Number(signatureScore.toFixed(2)), 0, 1)
  };
}
function inferScore(rawValue, fallback, inferredFields, field) {
  if (typeof rawValue === "number") {
    return rawValue;
  }
  inferredFields.push(field);
  return fallback;
}
function inferLocalSignals(raw, signatureScore, inferredFields) {
  if (raw.localSignals) {
    return {
      localFavoriteScore: raw.localSignals.localFavoriteScore ?? 0.72,
      neighborhoodPrideScore: raw.localSignals.neighborhoodPrideScore ?? 0.72,
      repeatVisitorScore: raw.localSignals.repeatVisitorScore ?? 0.72
    };
  }
  inferredFields.push("localSignals");
  const base = clamp2(0.58 + signatureScore * 0.24, 0.45, 0.92);
  return {
    localFavoriteScore: Number(base.toFixed(2)),
    neighborhoodPrideScore: Number((base + 0.04).toFixed(2)),
    repeatVisitorScore: Number((base - 0.02).toFixed(2))
  };
}
function inferRoleAffinity(raw, category, highlightTier, inferredFields) {
  if (raw.roleAffinity) {
    return {
      warmup: raw.roleAffinity.warmup ?? 0.5,
      peak: raw.roleAffinity.peak ?? 0.5,
      wildcard: raw.roleAffinity.wildcard ?? 0.5,
      cooldown: raw.roleAffinity.cooldown ?? 0.5
    };
  }
  inferredFields.push("roleAffinity");
  const baseByCategory = {
    restaurant: { warmup: 0.58, peak: 0.84, wildcard: 0.4, cooldown: 0.42 },
    bar: { warmup: 0.5, peak: 0.8, wildcard: 0.48, cooldown: 0.54 },
    cafe: { warmup: 0.86, peak: 0.42, wildcard: 0.52, cooldown: 0.82 },
    dessert: { warmup: 0.58, peak: 0.52, wildcard: 0.48, cooldown: 0.9 },
    live_music: { warmup: 0.42, peak: 0.86, wildcard: 0.82, cooldown: 0.38 },
    activity: { warmup: 0.48, peak: 0.8, wildcard: 0.82, cooldown: 0.34 },
    park: { warmup: 0.78, peak: 0.56, wildcard: 0.66, cooldown: 0.92 },
    museum: { warmup: 0.62, peak: 0.72, wildcard: 0.6, cooldown: 0.68 },
    event: { warmup: 0.54, peak: 0.76, wildcard: 0.86, cooldown: 0.44 }
  };
  const roleAffinity = { ...baseByCategory[category] };
  if (highlightTier === "support-only") {
    roleAffinity.peak = Math.max(0.48, roleAffinity.peak - 0.12);
    roleAffinity.cooldown = Math.min(0.96, roleAffinity.cooldown + 0.04);
  }
  if (highlightTier === "connective-only") {
    roleAffinity.peak = Math.max(0.3, roleAffinity.peak - 0.2);
    roleAffinity.wildcard = Math.max(0.34, roleAffinity.wildcard - 0.1);
  }
  return roleAffinity;
}
function inferVenueSignals({
  raw,
  category
}) {
  const inferredFields = [];
  const energyLevel = inferEnergyLevel(raw, category, inferredFields);
  const socialDensity = inferSocialDensity(raw, category, energyLevel, inferredFields);
  const vibeTags = inferVibeTags(raw, category, inferredFields);
  const audienceFlags = inferAudienceFlags(raw, category);
  const useCases = inferUseCases(raw, audienceFlags, inferredFields);
  const highlight = inferHighlightTier(raw, category);
  const signature = inferSignatureSignals(raw, category);
  const uniquenessScore = inferScore(
    raw.uniquenessScore,
    clamp2(0.52 + signature.signatureScore * 0.38, 0.4, 0.95),
    inferredFields,
    "uniquenessScore"
  );
  const distinctivenessScore = inferScore(
    raw.distinctivenessScore,
    clamp2(0.5 + signature.signatureScore * 0.42, 0.38, 0.96),
    inferredFields,
    "distinctivenessScore"
  );
  const underexposureScore = inferScore(
    raw.underexposureScore,
    clamp2(0.42 + (raw.isHiddenGem ? 0.22 : 0) + (signature.signatureScore - signature.genericScore) * 0.12, 0.25, 0.92),
    inferredFields,
    "underexposureScore"
  );
  const shareabilityScore = inferScore(
    raw.shareabilityScore,
    clamp2(0.48 + socialDensity * 0.06 + signature.signatureScore * 0.12, 0.35, 0.94),
    inferredFields,
    "shareabilityScore"
  );
  const isHiddenGem = typeof raw.isHiddenGem === "boolean" ? raw.isHiddenGem : signature.signatureScore >= 0.78 && underexposureScore >= 0.64;
  if (typeof raw.isHiddenGem !== "boolean") {
    inferredFields.push("isHiddenGem");
  }
  const isChain = raw.isChain ?? signature.chainLike;
  if (typeof raw.isChain !== "boolean") {
    inferredFields.push("isChain");
  }
  const setting = inferSetting(raw, category);
  const localSignals = inferLocalSignals(raw, signature.signatureScore, inferredFields);
  const roleAffinity = inferRoleAffinity(raw, category, highlight.tier, inferredFields);
  const durationProfileBase = getDurationProfile({
    category,
    tags: raw.tags ?? []
  });
  const durationProfile = {
    durationClass: durationProfileBase.durationClass,
    estimatedMinutes: durationProfileBase.baseMinutes
  };
  return {
    useCases,
    vibeTags,
    energyLevel,
    socialDensity,
    uniquenessScore,
    distinctivenessScore,
    underexposureScore,
    shareabilityScore,
    isHiddenGem,
    isChain,
    localSignals,
    roleAffinity,
    durationProfile,
    settings: {
      socialDensity,
      highlightCapabilityTier: highlight.tier,
      highlightConfidence: highlight.confidence,
      supportOnly: highlight.tier === "support-only",
      connectiveOnly: highlight.tier === "connective-only",
      setting,
      familyFriendly: audienceFlags.familyFriendly,
      adultSocial: audienceFlags.adultSocial,
      dateFriendly: audienceFlags.dateFriendly,
      eventCapable: raw.eventCapable ?? (category === "event" || hasAnyTag(raw, ["market", "pop-up", "community"])),
      musicCapable: raw.musicCapable ?? (category === "live_music" || hasAnyTag(raw, ["jazz", "listening", "acoustic"])),
      performanceCapable: raw.performanceCapable ?? (category === "live_music" || hasAnyTag(raw, ["performance", "small-stage", "guided", "gallery"])),
      routeFootprint: inferRouteFootprint(raw)
    },
    signature,
    inferredFields: [...new Set(inferredFields)]
  };
}

// src/domain/normalize/normalizeRawPlace.ts
function clamp016(value) {
  return Math.max(0, Math.min(1, value));
}
function collectMissingFields(raw) {
  const missing = [];
  if (!raw.city) {
    missing.push("city");
  }
  if (!raw.neighborhood) {
    missing.push("neighborhood");
  }
  if (typeof raw.driveMinutes !== "number") {
    missing.push("driveMinutes");
  }
  if (!raw.priceTier) {
    missing.push("priceTier");
  }
  if (!raw.shortDescription) {
    missing.push("shortDescription");
  }
  if (!raw.narrativeFlavor) {
    missing.push("narrativeFlavor");
  }
  if (!raw.tags || raw.tags.length === 0) {
    missing.push("tags");
  }
  return missing;
}
function normalizeRawPlace(raw, options = {}) {
  const categoryResult = getNormalizedCategory(raw);
  const inferred = inferVenueSignals({
    raw,
    category: categoryResult.category
  });
  const hoursPressure = inferHoursPressure({
    raw,
    category: categoryResult.category,
    timeWindowSignal: options.timeWindowSignal
  });
  const missingFields = collectMissingFields(raw);
  const completenessScore = clamp016(1 - missingFields.length * 0.1);
  const sourceConfidence = clamp016(
    typeof raw.sourceConfidence === "number" ? raw.sourceConfidence : 0.58 + completenessScore * 0.18 + inferred.signature.signatureScore * 0.1
  );
  const sourceOrigin = raw.sourceOrigin ?? (raw.normalizedFromRawType === "seed" ? "curated" : "live");
  const baseVenue = {
    id: raw.id,
    name: raw.name,
    city: raw.city ?? "San Jose",
    neighborhood: raw.neighborhood ?? "Unknown",
    driveMinutes: raw.driveMinutes ?? 14,
    category: categoryResult.category,
    subcategory: raw.subcategoryHint ?? categoryResult.subcategory,
    priceTier: raw.priceTier ?? "$$",
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
    imageUrl: raw.imageUrl ?? "",
    shortDescription: raw.shortDescription ?? `${raw.name} with a usable local fit profile.`,
    narrativeFlavor: raw.narrativeFlavor ?? "A normalized venue waiting for stronger narrative detail.",
    isHiddenGem: inferred.isHiddenGem,
    isActive: raw.isActive ?? true,
    highlightCapable: inferred.settings.highlightCapabilityTier === "highlight-capable",
    durationProfile: inferred.durationProfile,
    settings: inferred.settings,
    signature: inferred.signature,
    source: {
      normalizedFromRawType: raw.normalizedFromRawType ?? "raw-place",
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
      sourceTypes: [.../* @__PURE__ */ new Set([...raw.placeTypes ?? [], ...raw.sourceTypes ?? []])],
      missingFields,
      inferredFields: inferred.inferredFields,
      qualityGateStatus: "approved",
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: [],
      suppressionReasons: []
    }
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
      happenings: deriveVenueHappeningsSignals(baseVenue)
    }
  };
}

// src/domain/normalize/normalizeVenue.ts
function clamp017(value) {
  return Math.max(0, Math.min(1, value));
}
function collectMissingFields2(raw) {
  const missing = [];
  if (!raw.city) {
    missing.push("city");
  }
  if (!raw.neighborhood) {
    missing.push("neighborhood");
  }
  if (typeof raw.driveMinutes !== "number") {
    missing.push("driveMinutes");
  }
  if (!raw.shortDescription) {
    missing.push("shortDescription");
  }
  if (!raw.narrativeFlavor) {
    missing.push("narrativeFlavor");
  }
  return missing;
}
function normalizeRawEvent(raw, options = {}) {
  const categoryResult = getNormalizedCategory(raw);
  const inferred = inferVenueSignals({
    raw,
    category: categoryResult.category
  });
  const missingFields = collectMissingFields2(raw);
  const completenessScore = clamp017(1 - missingFields.length * 0.11);
  const sourceConfidence = clamp017(
    typeof raw.sourceConfidence === "number" ? raw.sourceConfidence : 0.52 + completenessScore * 0.16 + inferred.signature.signatureScore * 0.1
  );
  const hoursPressure = inferHoursPressure({
    raw: {
      ...raw,
      rawType: "place",
      placeTypes: raw.eventTypes
    },
    category: categoryResult.category,
    timeWindowSignal: options.timeWindowSignal
  });
  const sourceOrigin = raw.sourceOrigin ?? (raw.normalizedFromRawType === "seed" ? "curated" : "live");
  const baseVenue = {
    id: raw.id,
    name: raw.name,
    city: raw.city ?? "San Jose",
    neighborhood: raw.neighborhood ?? "Unknown",
    driveMinutes: raw.driveMinutes ?? 16,
    category: categoryResult.category,
    subcategory: raw.subcategoryHint ?? categoryResult.subcategory,
    priceTier: raw.priceTier ?? "$$",
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
    imageUrl: raw.imageUrl ?? "",
    shortDescription: raw.shortDescription ?? `${raw.name} with event-like local signal.`,
    narrativeFlavor: raw.narrativeFlavor ?? "An event-shaped venue normalized for engine use.",
    isHiddenGem: inferred.isHiddenGem,
    isActive: raw.isActive ?? true,
    highlightCapable: inferred.settings.highlightCapabilityTier === "highlight-capable",
    durationProfile: inferred.durationProfile,
    settings: {
      ...inferred.settings,
      eventCapable: true,
      performanceCapable: raw.performanceCapable ?? inferred.settings.performanceCapable
    },
    signature: inferred.signature,
    source: {
      normalizedFromRawType: raw.normalizedFromRawType ?? "raw-event",
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
      sourceTypes: [.../* @__PURE__ */ new Set([...raw.eventTypes ?? [], ...raw.sourceTypes ?? []])],
      missingFields,
      inferredFields: inferred.inferredFields,
      qualityGateStatus: "approved",
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: [],
      suppressionReasons: []
    }
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
      happenings: deriveVenueHappeningsSignals(baseVenue)
    }
  };
}
function normalizeVenue(raw, options = {}) {
  if (raw.rawType === "place") {
    return normalizeRawPlace(raw, options);
  }
  return normalizeRawEvent(raw, options);
}

// src/data/venues.ts
var categoryImages = {
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  bar: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80",
  cafe: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
  dessert: "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=1200&q=80",
  live_music: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1200&q=80",
  activity: "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=1200&q=80",
  park: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
  museum: "https://images.unsplash.com/photo-1566127992631-137a642a90f4?auto=format&fit=crop&w=1200&q=80",
  event: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80"
};
function makeVenue(seed) {
  return normalizeVenue({
    rawType: "place",
    id: seed.id,
    name: seed.name,
    city: seed.city ?? "San Jose",
    neighborhood: seed.neighborhood,
    driveMinutes: seed.driveMinutes,
    priceTier: seed.priceTier,
    tags: seed.tags,
    shortDescription: seed.shortDescription,
    narrativeFlavor: seed.narrativeFlavor,
    imageUrl: seed.imageUrl ?? categoryImages[seed.category],
    isActive: true,
    categoryHint: seed.category,
    subcategoryHint: seed.tags[0] ?? seed.category,
    sourceTypes: [seed.category, ...seed.tags.slice(0, 2)],
    normalizedFromRawType: "seed",
    sourceConfidence: 0.96,
    vibeTags: seed.vibeTags,
    useCases: seed.useCases,
    energyLevel: seed.energyLevel,
    socialDensity: seed.socialDensity,
    uniquenessScore: seed.uniquenessScore,
    distinctivenessScore: seed.distinctivenessScore,
    underexposureScore: seed.underexposureScore,
    shareabilityScore: seed.shareabilityScore,
    isHiddenGem: seed.isHiddenGem,
    isChain: seed.isChain,
    localSignals: {
      localFavoriteScore: seed.local[0],
      neighborhoodPrideScore: seed.local[1],
      repeatVisitorScore: seed.local[2]
    },
    roleAffinity: {
      warmup: seed.roles[0],
      peak: seed.roles[1],
      wildcard: seed.roles[2],
      cooldown: seed.roles[3]
    }
  });
}
var sanJoseVenues = [
  makeVenue({
    id: "sj-petiscos",
    name: "Petiscos",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["tapas", "chef-led", "elevated"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "cozy", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.83,
    underexposureScore: 0.62,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Small-plate dining with polished, modern comfort.",
    narrativeFlavor: "A confident culinary center point with real occasion feel.",
    isHiddenGem: false,
    local: [0.81, 0.75, 0.69],
    roles: [0.62, 0.92, 0.44, 0.36]
  }),
  makeVenue({
    id: "sj-orchard-city-kitchen",
    name: "Orchard City Kitchen",
    neighborhood: "Santana Row",
    driveMinutes: 15,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["new-american", "seasonal", "social"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "lively", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.79,
    distinctivenessScore: 0.7,
    underexposureScore: 0.4,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Refined plates with bright flavors and lively pacing.",
    narrativeFlavor: "A high-confidence anchor for social groups that love food.",
    isHiddenGem: false,
    local: [0.78, 0.7, 0.73],
    roles: [0.45, 0.9, 0.38, 0.35]
  }),
  makeVenue({
    id: "sj-nirvana-soul",
    name: "Nirvana Soul",
    neighborhood: "SoFA District",
    driveMinutes: 7,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "design-forward", "local"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "creative", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.91,
    underexposureScore: 0.74,
    shareabilityScore: 0.89,
    isChain: false,
    shortDescription: "Modern cafe ritual with local personality.",
    narrativeFlavor: "A smooth opening move that still feels special.",
    isHiddenGem: true,
    local: [0.9, 0.88, 0.76],
    roles: [0.93, 0.42, 0.54, 0.8]
  }),
  makeVenue({
    id: "sj-voyager-coffee",
    name: "Voyager Craft Coffee",
    neighborhood: "San Pedro",
    driveMinutes: 8,
    category: "cafe",
    priceTier: "$$",
    tags: ["third-wave", "quick-start", "craft"],
    useCases: ["socialite", "curator"],
    vibeTags: ["relaxed", "cozy", "playful"],
    energyLevel: 2,
    uniquenessScore: 0.72,
    distinctivenessScore: 0.64,
    underexposureScore: 0.52,
    shareabilityScore: 0.66,
    isChain: false,
    shortDescription: "Reliable craft coffee with upbeat local energy.",
    narrativeFlavor: "A practical, polished first stop for any mode.",
    isHiddenGem: false,
    local: [0.71, 0.69, 0.81],
    roles: [0.84, 0.33, 0.41, 0.74]
  }),
  makeVenue({
    id: "sj-paper-plane",
    name: "Paper Plane",
    neighborhood: "Downtown",
    driveMinutes: 5,
    category: "bar",
    priceTier: "$$$",
    tags: ["cocktails", "social", "stylish"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["lively", "creative", "playful"],
    energyLevel: 4,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.71,
    underexposureScore: 0.41,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "Signature cocktails and high-social atmosphere.",
    narrativeFlavor: "A polished surge in momentum for social plans.",
    isHiddenGem: false,
    local: [0.83, 0.74, 0.79],
    roles: [0.41, 0.82, 0.53, 0.55]
  }),
  makeVenue({
    id: "sj-miniboss",
    name: "MiniBoss",
    neighborhood: "Downtown",
    driveMinutes: 5,
    category: "activity",
    priceTier: "$$",
    tags: ["arcade", "games", "nostalgia"],
    useCases: ["socialite", "curator"],
    vibeTags: ["playful", "lively", "creative"],
    energyLevel: 5,
    uniquenessScore: 0.81,
    distinctivenessScore: 0.77,
    underexposureScore: 0.5,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Arcade-forward stop that instantly raises the tempo.",
    narrativeFlavor: "An easy crowd-pleaser when you want movement and laughs.",
    isHiddenGem: false,
    local: [0.8, 0.72, 0.68],
    roles: [0.4, 0.88, 0.86, 0.28]
  }),
  makeVenue({
    id: "sj-river-oaks-concert",
    name: "River Oaks Pop-Up Stage",
    neighborhood: "North San Jose",
    driveMinutes: 18,
    category: "live_music",
    priceTier: "$$",
    tags: ["local-artists", "small-stage", "community"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["lively", "culture", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.87,
    underexposureScore: 0.79,
    shareabilityScore: 0.73,
    isChain: false,
    shortDescription: "Intimate live set showcasing local performers.",
    narrativeFlavor: "A strong surprise candidate with real local signal.",
    isHiddenGem: true,
    local: [0.77, 0.85, 0.59],
    roles: [0.35, 0.79, 0.91, 0.3]
  }),
  makeVenue({
    id: "sj-tech-interactive",
    name: "The Tech Interactive",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "museum",
    priceTier: "$$",
    tags: ["hands-on", "innovation", "immersive"],
    useCases: ["socialite", "curator"],
    vibeTags: ["creative", "culture", "playful"],
    energyLevel: 3,
    uniquenessScore: 0.74,
    distinctivenessScore: 0.68,
    underexposureScore: 0.37,
    shareabilityScore: 0.71,
    isChain: false,
    shortDescription: "Interactive exhibits with high curiosity payoff.",
    narrativeFlavor: "A practical centerpiece for mixed-age plans.",
    isHiddenGem: false,
    local: [0.69, 0.7, 0.54],
    roles: [0.48, 0.76, 0.56, 0.52]
  }),
  makeVenue({
    id: "sj-rosicrucian",
    name: "Rosicrucian Egyptian Museum",
    neighborhood: "Rose Garden",
    driveMinutes: 12,
    category: "museum",
    priceTier: "$$",
    tags: ["historic", "curated", "iconic"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culture", "relaxed", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.89,
    distinctivenessScore: 0.92,
    underexposureScore: 0.64,
    shareabilityScore: 0.78,
    isChain: false,
    shortDescription: "Quietly iconic museum with deep visual character.",
    narrativeFlavor: "An elegant pivot for culture-led plans.",
    isHiddenGem: true,
    local: [0.86, 0.88, 0.58],
    roles: [0.68, 0.8, 0.62, 0.74]
  }),
  makeVenue({
    id: "sj-japanese-friendship-garden",
    name: "Japanese Friendship Garden",
    neighborhood: "Kelley Park",
    driveMinutes: 14,
    category: "park",
    priceTier: "$",
    tags: ["garden", "walk", "reflective"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.76,
    underexposureScore: 0.58,
    shareabilityScore: 0.8,
    isChain: false,
    shortDescription: "Calm pathways and scenic pauses built for reset.",
    narrativeFlavor: "A graceful landing spot for winding down.",
    isHiddenGem: true,
    local: [0.84, 0.9, 0.62],
    roles: [0.72, 0.43, 0.49, 0.95]
  }),
  makeVenue({
    id: "sj-alum-rock-loop",
    name: "Alum Rock Overlook Loop",
    neighborhood: "Alum Rock",
    driveMinutes: 22,
    category: "park",
    priceTier: "$",
    tags: ["trail", "viewpoint", "nature"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["outdoors", "playful", "relaxed"],
    energyLevel: 3,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.8,
    underexposureScore: 0.75,
    shareabilityScore: 0.77,
    isChain: false,
    shortDescription: "Short trail with strong scenic payoff and breathing room.",
    narrativeFlavor: "A smart wildcard for groups that want open-air contrast.",
    isHiddenGem: true,
    local: [0.79, 0.83, 0.67],
    roles: [0.61, 0.59, 0.83, 0.82]
  }),
  makeVenue({
    id: "sj-peters-bakery",
    name: "Peter's Bakery Burnt Almond",
    neighborhood: "Evergreen",
    driveMinutes: 19,
    category: "dessert",
    priceTier: "$$",
    tags: ["legacy", "dessert", "signature"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culinary", "playful"],
    energyLevel: 2,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.86,
    underexposureScore: 0.57,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Beloved local classic with instant dessert nostalgia.",
    narrativeFlavor: "A feel-good close with recognizable local character.",
    isHiddenGem: true,
    local: [0.92, 0.87, 0.81],
    roles: [0.49, 0.58, 0.66, 0.93]
  }),
  makeVenue({
    id: "sj-chromatic",
    name: "Chromatic Coffee Roastery",
    neighborhood: "Willow Glen",
    driveMinutes: 13,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "roastery", "intimate", "conversation", "linger", "neighborhood"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "relaxed", "culinary"],
    energyLevel: 1,
    socialDensity: 2,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.87,
    underexposureScore: 0.82,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Roastery stop with low-noise seating and easy linger tempo.",
    narrativeFlavor: "A strong warmup anchor for coffee-first Willow Glen sequencing.",
    isHiddenGem: true,
    local: [0.86, 0.89, 0.84],
    roles: [0.95, 0.58, 0.66, 0.95]
  }),
  makeVenue({
    id: "sj-guildhouse",
    name: "Guildhouse",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "activity",
    priceTier: "$$",
    tags: ["board-games", "esports", "community"],
    useCases: ["socialite", "curator"],
    vibeTags: ["playful", "creative", "lively"],
    energyLevel: 4,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.82,
    underexposureScore: 0.67,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Interactive gaming lounge with social momentum.",
    narrativeFlavor: "A flexible middle stop for friends or mixed-age groups.",
    isHiddenGem: true,
    local: [0.83, 0.76, 0.74],
    roles: [0.44, 0.8, 0.87, 0.37]
  }),
  makeVenue({
    id: "sj-sofa-street-market",
    name: "SoFA Street Market",
    neighborhood: "SoFA District",
    driveMinutes: 8,
    category: "event",
    priceTier: "$$",
    tags: ["pop-up", "makers", "weekend"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["creative", "culture", "playful"],
    energyLevel: 3,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.88,
    underexposureScore: 0.82,
    shareabilityScore: 0.75,
    isChain: false,
    shortDescription: "Rotating local makers and mini experiences in one strip.",
    narrativeFlavor: "A discovery-heavy wildcard with broad audience appeal.",
    isHiddenGem: true,
    local: [0.74, 0.82, 0.58],
    roles: [0.52, 0.72, 0.9, 0.43]
  }),
  makeVenue({
    id: "sj-lunas-mexican-kitchen",
    name: "Luna Mexican Kitchen",
    neighborhood: "The Alameda",
    driveMinutes: 11,
    category: "restaurant",
    priceTier: "$$",
    tags: ["regional", "comfort", "colorful"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "cozy", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.73,
    distinctivenessScore: 0.67,
    underexposureScore: 0.44,
    shareabilityScore: 0.77,
    isChain: false,
    shortDescription: "Warm, colorful dining with broad group appeal.",
    narrativeFlavor: "A dependable highlight with easy crowd alignment.",
    isHiddenGem: false,
    local: [0.81, 0.77, 0.84],
    roles: [0.58, 0.79, 0.35, 0.4]
  }),
  makeVenue({
    id: "sj-adega-wine-atelier",
    name: "Adega Wine Atelier",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "restaurant",
    priceTier: "$$$$",
    tags: ["tasting-menu", "wine-pairing", "elevated"],
    useCases: ["romantic"],
    vibeTags: ["culinary", "culture", "cozy"],
    energyLevel: 3,
    uniquenessScore: 0.91,
    distinctivenessScore: 0.88,
    underexposureScore: 0.54,
    shareabilityScore: 0.87,
    isChain: false,
    shortDescription: "Refined tasting experience with slower, intentional pacing.",
    narrativeFlavor: "A romantic highlight with clear occasion energy.",
    isHiddenGem: false,
    local: [0.82, 0.76, 0.6],
    roles: [0.48, 0.94, 0.42, 0.46]
  }),
  makeVenue({
    id: "sj-theatre-district-jazz-cellar",
    name: "Theatre District Jazz Cellar",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "live_music",
    priceTier: "$$$",
    tags: ["jazz", "listening", "intimate"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culture", "cozy", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.9,
    underexposureScore: 0.69,
    shareabilityScore: 0.81,
    isChain: false,
    shortDescription: "Low-light listening room with a focused local lineup.",
    narrativeFlavor: "A soulful highlight that keeps plans feeling curated.",
    isHiddenGem: true,
    local: [0.79, 0.73, 0.66],
    roles: [0.45, 0.86, 0.85, 0.52]
  }),
  makeVenue({
    id: "sj-willow-glen-tea-atelier",
    name: "Willow Glen Tea Atelier",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "cafe",
    priceTier: "$$",
    tags: ["tea-room", "intimate", "low-noise", "linger", "neighborhood"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "relaxed", "culture"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.87,
    underexposureScore: 0.85,
    shareabilityScore: 0.72,
    isChain: false,
    shortDescription: "Tea-forward room with serene pacing and local pastries.",
    narrativeFlavor: "A premium low-friction anchor for emotionally soft routing.",
    isHiddenGem: true,
    local: [0.85, 0.83, 0.72],
    roles: [0.93, 0.34, 0.6, 0.96]
  }),
  makeVenue({
    id: "sj-little-portugal-pastry-bar",
    name: "Little Portugal Pastry Bar",
    neighborhood: "Evergreen",
    driveMinutes: 17,
    category: "dessert",
    priceTier: "$$",
    tags: ["pasteis", "local", "cozy"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "cozy", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.9,
    distinctivenessScore: 0.84,
    underexposureScore: 0.7,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Neighborhood pastry stop with easy linger energy.",
    narrativeFlavor: "A comforting close that still feels discovered.",
    isHiddenGem: true,
    local: [0.8, 0.82, 0.75],
    roles: [0.62, 0.54, 0.66, 0.9]
  }),
  makeVenue({
    id: "sj-municipal-rose-garden-promenade",
    name: "Municipal Rose Garden Promenade",
    neighborhood: "Rose Garden",
    driveMinutes: 11,
    category: "park",
    priceTier: "$",
    tags: ["scenic", "stroll", "photogenic"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.78,
    underexposureScore: 0.52,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Classic garden walk with strong visual payoff.",
    narrativeFlavor: "A reliable start or soft landing for slower plans.",
    isHiddenGem: false,
    local: [0.86, 0.89, 0.84],
    roles: [0.88, 0.52, 0.48, 0.92]
  }),
  makeVenue({
    id: "sj-santana-rooftop-lounge",
    name: "Santana Rooftop Lounge",
    neighborhood: "Santana Row",
    driveMinutes: 15,
    category: "bar",
    priceTier: "$$$",
    tags: ["rooftop", "craft", "social"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["lively", "cozy", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.74,
    distinctivenessScore: 0.71,
    underexposureScore: 0.35,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Open-air lounge energy with polished cocktails.",
    narrativeFlavor: "A high-energy highlight for social groups.",
    isHiddenGem: false,
    local: [0.73, 0.7, 0.77],
    roles: [0.46, 0.84, 0.47, 0.56]
  }),
  makeVenue({
    id: "sj-family-art-lab",
    name: "Family Art Lab Collective",
    neighborhood: "SoFA District",
    driveMinutes: 9,
    category: "activity",
    priceTier: "$$",
    tags: ["hands-on", "family-friendly", "studio"],
    useCases: ["curator", "socialite"],
    vibeTags: ["creative", "playful", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.85,
    underexposureScore: 0.78,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Drop-in art activities with guided mini workshops.",
    narrativeFlavor: "A family-safe highlight with real novelty.",
    isHiddenGem: true,
    local: [0.79, 0.8, 0.62],
    roles: [0.62, 0.82, 0.74, 0.55]
  }),
  makeVenue({
    id: "sj-childrens-discovery-museum",
    name: "Children's Discovery Museum",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "museum",
    priceTier: "$$",
    tags: ["interactive", "family-friendly", "learning"],
    useCases: ["curator"],
    vibeTags: ["playful", "culture", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.76,
    distinctivenessScore: 0.72,
    underexposureScore: 0.44,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Hands-on exhibits tuned for family discovery.",
    narrativeFlavor: "A dependable family highlight with low confusion.",
    isHiddenGem: false,
    local: [0.82, 0.78, 0.69],
    roles: [0.6, 0.86, 0.52, 0.58]
  }),
  makeVenue({
    id: "sj-happy-hollow-adventure-corner",
    name: "Happy Hollow Adventure Corner",
    neighborhood: "Kelley Park",
    driveMinutes: 13,
    category: "activity",
    priceTier: "$$",
    tags: ["family-friendly", "outdoor-play", "animals"],
    useCases: ["curator"],
    vibeTags: ["playful", "outdoors", "relaxed"],
    energyLevel: 3,
    uniquenessScore: 0.74,
    distinctivenessScore: 0.69,
    underexposureScore: 0.43,
    shareabilityScore: 0.7,
    isChain: false,
    shortDescription: "Kid-centered activity stop with easy pacing options.",
    narrativeFlavor: "A family-safe highlight that avoids nightlife energy.",
    isHiddenGem: false,
    local: [0.75, 0.8, 0.72],
    roles: [0.58, 0.81, 0.46, 0.54]
  }),
  makeVenue({
    id: "sj-japantown-makers-market",
    name: "Japantown Makers Market",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "event",
    priceTier: "$$",
    tags: ["market", "discovery", "movement", "cultural-flow", "community"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["creative", "culture", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.91,
    underexposureScore: 0.84,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Local maker booths with rotating micro-experiences.",
    narrativeFlavor: "A cultural-flow wildcard that stitches together a layered Japantown route.",
    isHiddenGem: true,
    local: [0.82, 0.9, 0.58],
    roles: [0.6, 0.7, 0.95, 0.52]
  }),
  makeVenue({
    id: "sj-heritage-tea-house",
    name: "Heritage Tea House",
    neighborhood: "Rose Garden",
    driveMinutes: 11,
    category: "cafe",
    priceTier: "$$",
    tags: ["tea-room", "heritage", "quiet"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culture", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.8,
    underexposureScore: 0.76,
    shareabilityScore: 0.68,
    isChain: false,
    shortDescription: "Calm tea service in a heritage-style setting.",
    narrativeFlavor: "A graceful wind down for romantic and family routes.",
    isHiddenGem: true,
    local: [0.78, 0.82, 0.73],
    roles: [0.88, 0.44, 0.61, 0.94]
  }),
  makeVenue({
    id: "sj-story-road-ice-cream-social",
    name: "Story Road Ice Cream Social",
    neighborhood: "Evergreen",
    driveMinutes: 16,
    category: "dessert",
    priceTier: "$",
    tags: ["ice-cream", "family-friendly", "casual"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["playful", "cozy", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.72,
    distinctivenessScore: 0.66,
    underexposureScore: 0.55,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Simple dessert stop with broad crowd appeal.",
    narrativeFlavor: "A low-friction closing move after busier highlights.",
    isHiddenGem: false,
    local: [0.83, 0.79, 0.86],
    roles: [0.56, 0.5, 0.49, 0.91]
  }),
  makeVenue({
    id: "sj-alum-rock-picnic-grove",
    name: "Alum Rock Picnic Grove",
    neighborhood: "Alum Rock",
    driveMinutes: 20,
    category: "park",
    priceTier: "$",
    tags: ["picnic", "shade", "family-friendly"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.73,
    underexposureScore: 0.67,
    shareabilityScore: 0.7,
    isChain: false,
    shortDescription: "Scenic picnic pockets away from busier strips.",
    narrativeFlavor: "A restorative wind down for low-movement plans.",
    isHiddenGem: true,
    local: [0.76, 0.82, 0.65],
    roles: [0.8, 0.46, 0.58, 0.93]
  }),
  makeVenue({
    id: "sj-downtown-listening-room",
    name: "Downtown Listening Room",
    neighborhood: "SoFA District",
    driveMinutes: 8,
    category: "live_music",
    priceTier: "$$",
    tags: ["listening", "acoustic", "small-stage"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culture", "cozy", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.85,
    distinctivenessScore: 0.88,
    underexposureScore: 0.77,
    shareabilityScore: 0.73,
    isChain: false,
    shortDescription: "Acoustic-forward room with a more intimate crowd.",
    narrativeFlavor: "A curated highlight that avoids noisy chaos.",
    isHiddenGem: true,
    local: [0.77, 0.81, 0.61],
    roles: [0.46, 0.82, 0.89, 0.5]
  }),
  makeVenue({
    id: "sj-sofa-indie-gallery-crawl",
    name: "SoFA Indie Gallery Crawl",
    neighborhood: "SoFA District",
    driveMinutes: 8,
    category: "event",
    priceTier: "$$",
    tags: ["gallery", "indie", "walkable"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["creative", "culture", "outdoors"],
    energyLevel: 2,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.91,
    underexposureScore: 0.86,
    shareabilityScore: 0.79,
    isChain: false,
    shortDescription: "Light walking route through rotating local galleries.",
    narrativeFlavor: "A daytime surprise that feels premium and local.",
    isHiddenGem: true,
    local: [0.74, 0.86, 0.53],
    roles: [0.66, 0.74, 0.95, 0.52]
  }),
  makeVenue({
    id: "sj-makers-vintage-hall",
    name: "Makers and Vintage Hall",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "event",
    priceTier: "$$",
    tags: ["vintage", "community", "market"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["creative", "playful", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.86,
    underexposureScore: 0.8,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Curated vendors, vinyl, and rotating local makers.",
    narrativeFlavor: "A flexible surprise stop for curate-mode exploration.",
    isHiddenGem: true,
    local: [0.75, 0.79, 0.57],
    roles: [0.57, 0.68, 0.92, 0.45]
  }),
  makeVenue({
    id: "sj-riverwalk-boardgame-cafe",
    name: "Riverwalk Boardgame Cafe",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "cafe",
    priceTier: "$$",
    tags: ["board-games", "social", "low-key"],
    useCases: ["socialite", "curator"],
    vibeTags: ["playful", "relaxed", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.81,
    underexposureScore: 0.72,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Tabletop cafe with easy pacing for mixed groups.",
    narrativeFlavor: "A soft social stop that avoids second-peak endings.",
    isHiddenGem: true,
    local: [0.81, 0.78, 0.73],
    roles: [0.79, 0.52, 0.67, 0.88]
  }),
  makeVenue({
    id: "sj-preserve-botanical-studio",
    name: "Preserve Botanical Studio",
    neighborhood: "Willow Glen",
    driveMinutes: 13,
    category: "park",
    priceTier: "$$",
    tags: ["garden", "reset", "walkable", "open-air", "calm"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "cozy", "relaxed"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.89,
    underexposureScore: 0.84,
    shareabilityScore: 0.8,
    isChain: false,
    shortDescription: "Small botanical pockets with quiet seating corners.",
    narrativeFlavor: "A low-intensity reset that improves Willow Glen sequence flow.",
    isHiddenGem: true,
    local: [0.8, 0.84, 0.66],
    roles: [0.9, 0.42, 0.72, 0.97]
  }),
  makeVenue({
    id: "sj-electric-alley-karaoke",
    name: "Electric Alley Karaoke",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "activity",
    priceTier: "$$",
    tags: ["karaoke", "group", "high-energy"],
    useCases: ["socialite"],
    vibeTags: ["lively", "playful", "creative"],
    energyLevel: 5,
    uniquenessScore: 0.79,
    distinctivenessScore: 0.75,
    underexposureScore: 0.49,
    shareabilityScore: 0.91,
    isChain: false,
    shortDescription: "Private rooms and group sing-along energy.",
    narrativeFlavor: "A friends highlight with clear high-tempo payoff.",
    isHiddenGem: false,
    local: [0.78, 0.73, 0.71],
    roles: [0.38, 0.9, 0.75, 0.25]
  }),
  makeVenue({
    id: "sj-san-pedro-beer-garden",
    name: "San Pedro Beer Garden",
    neighborhood: "San Pedro",
    driveMinutes: 7,
    category: "bar",
    priceTier: "$$",
    tags: ["beer-garden", "social", "outdoor-seating"],
    useCases: ["socialite"],
    vibeTags: ["lively", "playful", "outdoors"],
    energyLevel: 4,
    uniquenessScore: 0.73,
    distinctivenessScore: 0.68,
    underexposureScore: 0.38,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Casual social stop with easy group seating.",
    narrativeFlavor: "A practical start or highlight for friends mode.",
    isHiddenGem: false,
    local: [0.81, 0.77, 0.82],
    roles: [0.62, 0.82, 0.43, 0.51]
  }),
  makeVenue({
    id: "sj-hidden-courtyard-cocktail",
    name: "Hidden Courtyard Cocktail Bar",
    neighborhood: "SoFA District",
    driveMinutes: 8,
    category: "bar",
    priceTier: "$$$",
    tags: ["speakeasy", "craft", "understated"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "creative", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.9,
    distinctivenessScore: 0.88,
    underexposureScore: 0.84,
    shareabilityScore: 0.83,
    isChain: false,
    shortDescription: "Quiet courtyard cocktails with local seasonal menus.",
    narrativeFlavor: "A high-value surprise for discovery-heavy plans.",
    isHiddenGem: true,
    local: [0.74, 0.78, 0.59],
    roles: [0.52, 0.77, 0.93, 0.65]
  }),
  makeVenue({
    id: "sj-sketchbook-supper-club",
    name: "Sketchbook Supper Club",
    neighborhood: "SoFA District",
    driveMinutes: 9,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["chef-led", "artful", "intimate"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "creative", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.89,
    distinctivenessScore: 0.9,
    underexposureScore: 0.76,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "Art-forward tasting plates and conversational pacing.",
    narrativeFlavor: "A premium highlight with personality.",
    isHiddenGem: true,
    local: [0.76, 0.82, 0.62],
    roles: [0.54, 0.9, 0.79, 0.48]
  }),
  makeVenue({
    id: "sj-farmers-lane-food-hall",
    name: "Farmers Lane Food Hall Nights",
    neighborhood: "North San Jose",
    driveMinutes: 18,
    category: "event",
    priceTier: "$$",
    tags: ["food-hall", "live-popups", "community"],
    useCases: ["socialite", "curator"],
    vibeTags: ["culinary", "playful", "lively"],
    energyLevel: 4,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.74,
    underexposureScore: 0.61,
    shareabilityScore: 0.79,
    isChain: false,
    shortDescription: "Rotating food stalls with frequent local popups.",
    narrativeFlavor: "A social highlight or surprise for group outings.",
    isHiddenGem: false,
    local: [0.73, 0.71, 0.64],
    roles: [0.48, 0.83, 0.74, 0.44]
  }),
  makeVenue({
    id: "sj-moonlight-mini-golf",
    name: "Moonlight Mini Golf",
    neighborhood: "Downtown",
    driveMinutes: 8,
    category: "activity",
    priceTier: "$$",
    tags: ["mini-golf", "playful", "group"],
    useCases: ["socialite", "curator", "romantic"],
    vibeTags: ["playful", "lively", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.77,
    distinctivenessScore: 0.73,
    underexposureScore: 0.58,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Easy playful competition with compact travel footprint.",
    narrativeFlavor: "A light-hearted surprise that still feels structured.",
    isHiddenGem: false,
    local: [0.76, 0.75, 0.7],
    roles: [0.5, 0.81, 0.79, 0.39]
  }),
  makeVenue({
    id: "sj-evergreen-observatory-nights",
    name: "Evergreen Observatory Nights",
    neighborhood: "Evergreen",
    driveMinutes: 21,
    category: "event",
    priceTier: "$$",
    tags: ["stargazing", "community", "quiet"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culture", "outdoors", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.91,
    distinctivenessScore: 0.92,
    underexposureScore: 0.88,
    shareabilityScore: 0.77,
    isChain: false,
    shortDescription: "Local astronomy evenings with guided telescope access.",
    narrativeFlavor: "A distinctive surprise that is not nightlife-coded.",
    isHiddenGem: true,
    local: [0.7, 0.79, 0.49],
    roles: [0.6, 0.7, 0.95, 0.62]
  }),
  makeVenue({
    id: "sj-camera-obscura-photo-walk",
    name: "Camera Obscura Photo Walk",
    neighborhood: "Downtown",
    driveMinutes: 7,
    category: "activity",
    priceTier: "$$",
    tags: ["photo-walk", "guided", "creative"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["creative", "outdoors", "culture"],
    energyLevel: 2,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.9,
    underexposureScore: 0.85,
    shareabilityScore: 0.91,
    isChain: false,
    shortDescription: "Guided city photo loop through overlooked scenic pockets.",
    narrativeFlavor: "A non-nightlife surprise with strong shareability.",
    isHiddenGem: true,
    local: [0.74, 0.81, 0.55],
    roles: [0.72, 0.73, 0.94, 0.58]
  }),
  makeVenue({
    id: "sj-orchard-artisan-gelato",
    name: "Orchard Artisan Gelato",
    neighborhood: "Downtown",
    driveMinutes: 6,
    category: "dessert",
    priceTier: "$$",
    tags: ["gelato", "artisan", "walk-up"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culinary", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.79,
    distinctivenessScore: 0.75,
    underexposureScore: 0.63,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "Artisan scoops and low-friction seating for quick resets.",
    narrativeFlavor: "A smooth close that keeps the plan feeling complete.",
    isHiddenGem: true,
    local: [0.84, 0.77, 0.83],
    roles: [0.61, 0.46, 0.58, 0.94]
  }),
  makeVenue({
    id: "sj-rose-garden-bistro",
    name: "Rose Garden Bistro",
    neighborhood: "Rose Garden",
    driveMinutes: 11,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["neighborhood", "wine", "comfort"],
    useCases: ["romantic", "curator", "socialite"],
    vibeTags: ["culinary", "cozy", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.75,
    distinctivenessScore: 0.7,
    underexposureScore: 0.49,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Neighborhood bistro with polished but low-noise service.",
    narrativeFlavor: "A warm wind down for groups wanting an easy finish.",
    isHiddenGem: false,
    local: [0.82, 0.84, 0.86],
    roles: [0.64, 0.72, 0.44, 0.87]
  }),
  makeVenue({
    id: "sj-willow-glen-bookhouse",
    name: "Willow Glen Bookhouse",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "activity",
    priceTier: "$$",
    tags: ["bookshop", "intimate", "low-noise", "linger", "neighborhood"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culture", "relaxed"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.89,
    underexposureScore: 0.86,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Independent bookshop with curated shelves and quiet seating nooks.",
    narrativeFlavor: "A soft anchor that reinforces Willow Glen low-friction sequencing.",
    isHiddenGem: true,
    local: [0.88, 0.9, 0.78],
    roles: [0.94, 0.34, 0.62, 0.96]
  }),
  makeVenue({
    id: "sj-lincoln-avenue-deli",
    name: "Lincoln Avenue Deli",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "restaurant",
    priceTier: "$$",
    tags: ["deli", "neighborhood", "quiet", "linger"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "cozy", "relaxed"],
    energyLevel: 1,
    socialDensity: 2,
    uniquenessScore: 0.75,
    distinctivenessScore: 0.72,
    underexposureScore: 0.63,
    shareabilityScore: 0.68,
    isChain: false,
    shortDescription: "Local deli counter with polished comfort classics.",
    narrativeFlavor: "A low-noise support stop that keeps Willow Glen cohesive.",
    isHiddenGem: false,
    local: [0.87, 0.88, 0.84],
    roles: [0.84, 0.58, 0.41, 0.79]
  }),
  makeVenue({
    id: "sj-willow-glen-bakehouse",
    name: "Willow Glen Bakehouse",
    neighborhood: "Willow Glen",
    driveMinutes: 11,
    category: "dessert",
    priceTier: "$$",
    tags: ["bakery", "artisan", "intimate", "low-noise", "linger", "neighborhood"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culinary", "relaxed"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.84,
    underexposureScore: 0.78,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Neighborhood pastry shop known for buttery seasonal bakes.",
    narrativeFlavor: "An easy warmup or wind-down that supports emotionally soft pacing.",
    isHiddenGem: true,
    local: [0.9, 0.91, 0.82],
    roles: [0.82, 0.4, 0.53, 0.96]
  }),
  makeVenue({
    id: "sj-willow-court-wine-bar",
    name: "Willow Court Wine Bar",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$$",
    tags: ["wine-bar", "wine", "intimate", "conversation", "slow-dining", "linger", "date night"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "culinary", "culture"],
    energyLevel: 1,
    socialDensity: 2,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.88,
    underexposureScore: 0.79,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Quiet pours and small plates with neighborhood patio energy.",
    narrativeFlavor: "A slower dinner-wine anchor with strong conversation gravity.",
    isHiddenGem: true,
    local: [0.91, 0.93, 0.82],
    roles: [0.68, 0.97, 0.66, 0.93]
  }),
  makeVenue({
    id: "sj-lincoln-avenue-pasta-room",
    name: "Lincoln Avenue Pasta Room",
    neighborhood: "Willow Glen",
    driveMinutes: 13,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["italian", "intimate", "conversation", "slow-dining", "quiet"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "cozy", "culture"],
    energyLevel: 1,
    socialDensity: 2,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.83,
    underexposureScore: 0.69,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Quieter dinner room with handmade pasta and slower service pacing.",
    narrativeFlavor: "A slower dinner anchor that keeps Willow Glen soft and settled.",
    isHiddenGem: false,
    local: [0.83, 0.87, 0.75],
    roles: [0.5, 0.94, 0.42, 0.74]
  }),
  makeVenue({
    id: "sj-bramhall-park-promenade",
    name: "Bramhall Park Promenade",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "park",
    priceTier: "$",
    tags: ["park", "reset", "walkable", "open air", "stroll", "linger"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "cozy", "relaxed"],
    energyLevel: 1,
    socialDensity: 1,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.76,
    underexposureScore: 0.74,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Shaded neighborhood park loop with calm evening foot traffic.",
    narrativeFlavor: "A reset anchor that strengthens warmup and cooldown sequence quality.",
    isHiddenGem: false,
    local: [0.86, 0.91, 0.84],
    roles: [0.93, 0.44, 0.68, 0.98]
  }),
  makeVenue({
    id: "sj-willow-glen-village-stroll",
    name: "Willow Glen Village Stroll",
    neighborhood: "Willow Glen",
    driveMinutes: 12,
    category: "event",
    priceTier: "$$",
    tags: ["main-street", "walkable", "stroll", "open air", "reset", "community", "sequence"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "cozy", "outdoors"],
    energyLevel: 2,
    socialDensity: 2,
    uniquenessScore: 0.9,
    distinctivenessScore: 0.9,
    underexposureScore: 0.84,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Evening-friendly main-street micro events and local storefront popups.",
    narrativeFlavor: "A stroll anchor that links coffee, reset, and slower dinner in one district rhythm.",
    isHiddenGem: true,
    local: [0.86, 0.92, 0.72],
    roles: [0.82, 0.78, 0.95, 0.92]
  }),
  makeVenue({
    id: "sj-jtown-santo-market-counter",
    name: "Santo Market Counter",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "restaurant",
    priceTier: "$$",
    tags: ["japanese", "authentic", "local", "cultural"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "culture", "cozy"],
    energyLevel: 2,
    socialDensity: 3,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.88,
    underexposureScore: 0.73,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Japanese comfort plates with a long-running neighborhood following.",
    narrativeFlavor: "An authentic food-forward anchor with clear cultural specificity.",
    isHiddenGem: true,
    local: [0.9, 0.92, 0.79],
    roles: [0.66, 0.83, 0.55, 0.66]
  }),
  makeVenue({
    id: "sj-jtown-manju-house",
    name: "Jtown Manju House",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "dessert",
    priceTier: "$$",
    tags: ["wagashi", "confectionary", "dessert", "cultural-anchor", "unique", "historic", "local-only", "signature"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "cozy", "culture"],
    energyLevel: 1,
    uniquenessScore: 0.93,
    distinctivenessScore: 0.96,
    underexposureScore: 0.87,
    shareabilityScore: 0.94,
    isChain: false,
    shortDescription: "Traditional Japanese sweets with seasonal handmade rotation.",
    narrativeFlavor: "A heritage confectionary anchor that reads uniquely Japantown.",
    isHiddenGem: true,
    local: [0.94, 0.95, 0.8],
    roles: [0.84, 0.66, 0.79, 0.95]
  }),
  makeVenue({
    id: "sj-jtown-matcha-kissaten",
    name: "Jtown Matcha Kissaten",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "cafe",
    priceTier: "$$",
    tags: ["matcha", "tea", "cultural-anchor", "historic", "slow-cafe"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culture", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.86,
    underexposureScore: 0.8,
    shareabilityScore: 0.75,
    isChain: false,
    shortDescription: "Tea-focused cafe with quiet seating and measured pacing.",
    narrativeFlavor: "A calm cultural warmup that deepens Japantown identity.",
    isHiddenGem: true,
    local: [0.87, 0.91, 0.74],
    roles: [0.91, 0.39, 0.6, 0.95]
  }),
  makeVenue({
    id: "sj-jtown-ramen-ya",
    name: "Jtown Ramen Ya",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "restaurant",
    priceTier: "$$",
    tags: ["ramen", "authentic", "local", "cultural", "small-dining", "neighborhood", "noodle-house"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culinary", "lively", "culture"],
    energyLevel: 3,
    socialDensity: 3,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.88,
    underexposureScore: 0.72,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Neighborhood ramen room with line-friendly evening energy.",
    narrativeFlavor: "An authentic dining anchor with medium-noise neighborhood buzz.",
    isHiddenGem: false,
    local: [0.9, 0.92, 0.85],
    roles: [0.68, 0.95, 0.62, 0.7]
  }),
  makeVenue({
    id: "sj-jtown-sake-corner",
    name: "Jtown Sake Corner",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "bar",
    priceTier: "$$$",
    tags: ["sake", "small-plates", "authentic", "local", "cultural", "conversation"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culture", "cozy", "culinary"],
    energyLevel: 2,
    socialDensity: 3,
    uniquenessScore: 0.85,
    distinctivenessScore: 0.84,
    underexposureScore: 0.71,
    shareabilityScore: 0.8,
    isChain: false,
    shortDescription: "Small sake list and shareable plates in a low-light room.",
    narrativeFlavor: "A culturally specific small-room peak with conversation-forward pacing.",
    isHiddenGem: true,
    local: [0.83, 0.88, 0.72],
    roles: [0.5, 0.81, 0.65, 0.8]
  }),
  makeVenue({
    id: "sj-jtown-okayama-mural-walk",
    name: "Okayama Mural Walk",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "activity",
    priceTier: "$",
    tags: ["murals", "historic", "curated", "immersive", "discovery", "movement", "cultural-flow", "local-only", "walkable"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "outdoors", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.94,
    distinctivenessScore: 0.96,
    underexposureScore: 0.89,
    shareabilityScore: 0.94,
    isChain: false,
    shortDescription: "Guided-lite mural loop highlighting neighborhood history markers.",
    narrativeFlavor: "A discovery-led movement anchor that layers history into the route.",
    isHiddenGem: true,
    local: [0.88, 0.93, 0.66],
    roles: [0.82, 0.78, 0.98, 0.84]
  }),
  makeVenue({
    id: "sj-jtown-jamsj-gallery",
    name: "Japanese American Gallery SJ",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "museum",
    priceTier: "$$",
    tags: ["heritage", "historic", "cultural-anchor", "unique", "exhibits"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culture", "creative", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.92,
    underexposureScore: 0.81,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Compact gallery documenting Japanese American local history.",
    narrativeFlavor: "A layered cultural support venue with strong neighborhood specificity.",
    isHiddenGem: true,
    local: [0.86, 0.92, 0.69],
    roles: [0.74, 0.67, 0.8, 0.89]
  }),
  makeVenue({
    id: "sj-jtown-jacques-plaza",
    name: "Jacques Plaza Courtyard",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "park",
    priceTier: "$",
    tags: ["courtyard", "discovery", "movement", "cultural-flow", "walkable"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.72,
    distinctivenessScore: 0.71,
    underexposureScore: 0.62,
    shareabilityScore: 0.69,
    isChain: false,
    shortDescription: "Small public courtyard with easy pauses between food stops.",
    narrativeFlavor: "A movement-friendly connector that improves Japantown sequence flow.",
    isHiddenGem: false,
    local: [0.79, 0.86, 0.77],
    roles: [0.79, 0.34, 0.56, 0.96]
  }),
  makeVenue({
    id: "sj-jtown-culture-night-market",
    name: "Jtown Culture Night Market",
    neighborhood: "Japantown",
    driveMinutes: 10,
    category: "event",
    priceTier: "$$",
    tags: ["night-market", "night market", "event", "cultural-energy", "market", "vendor", "curated", "discovery", "movement", "cultural-flow"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "lively", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.92,
    distinctivenessScore: 0.96,
    underexposureScore: 0.91,
    shareabilityScore: 0.91,
    isChain: false,
    shortDescription: "Periodic market nights with Japanese food stalls and maker booths.",
    narrativeFlavor: "A layered event anchor that delivers distinctive cultural energy.",
    isHiddenGem: true,
    local: [0.87, 0.94, 0.68],
    roles: [0.72, 0.9, 0.98, 0.76]
  })
];
var denverVenues = [
  makeVenue({
    id: "de-union-station-coffee-hall",
    name: "Union Station Coffee Hall",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 8,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "historic", "warmup", "walkable"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culture", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.82,
    underexposureScore: 0.61,
    shareabilityScore: 0.8,
    isChain: false,
    shortDescription: "Historic station coffee ritual with easy walking access.",
    narrativeFlavor: "A polished start anchor with classic LoDo character.",
    isHiddenGem: false,
    local: [0.83, 0.81, 0.77],
    roles: [0.94, 0.45, 0.52, 0.82]
  }),
  makeVenue({
    id: "de-mercantile-dining",
    name: "Mercantile Dining Hall",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 9,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["chef-led", "lodo", "seasonal", "conversation"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "culture", "cozy"],
    energyLevel: 3,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.83,
    underexposureScore: 0.59,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Refined dining with local sourcing and steady pacing.",
    narrativeFlavor: "A strong food anchor that keeps Downtown/LoDo intentional.",
    isHiddenGem: false,
    local: [0.82, 0.79, 0.71],
    roles: [0.55, 0.91, 0.47, 0.46]
  }),
  makeVenue({
    id: "de-cooper-lounge",
    name: "Cooper Lounge Loft",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 9,
    category: "bar",
    priceTier: "$$$",
    tags: ["cocktails", "historic", "conversation", "slow-dining"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "culture", "creative"],
    energyLevel: 3,
    socialDensity: 3,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.8,
    underexposureScore: 0.56,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Rail-station cocktail room with a slower social pulse.",
    narrativeFlavor: "An elevated highlight without generic nightlife noise.",
    isHiddenGem: false,
    local: [0.78, 0.75, 0.72],
    roles: [0.48, 0.84, 0.52, 0.72]
  }),
  makeVenue({
    id: "de-larimer-square-stroll",
    name: "Larimer Square Stroll",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 8,
    category: "activity",
    priceTier: "$",
    tags: ["walkable", "historic", "lights", "movement"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "outdoors", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.81,
    underexposureScore: 0.58,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "Historic block walk with easy transitions between stops.",
    narrativeFlavor: "A sequence connector that keeps Downtown cohesive.",
    isHiddenGem: false,
    local: [0.79, 0.84, 0.76],
    roles: [0.8, 0.62, 0.92, 0.83]
  }),
  makeVenue({
    id: "de-dairy-block-alley",
    name: "Dairy Block Alley Market",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 8,
    category: "event",
    priceTier: "$$",
    tags: ["market", "courtyard", "event", "walkable"],
    useCases: ["socialite", "curator"],
    vibeTags: ["lively", "culture", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.79,
    underexposureScore: 0.63,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Micro-market corridor with rotating food and makers.",
    narrativeFlavor: "A compact event node with layered downtown options.",
    isHiddenGem: true,
    local: [0.8, 0.83, 0.7],
    roles: [0.62, 0.88, 0.9, 0.58]
  }),
  makeVenue({
    id: "de-milk-market-hall",
    name: "Milk Market Hall",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 9,
    category: "event",
    priceTier: "$$",
    tags: ["food-hall", "group-friendly", "social", "variety"],
    useCases: ["socialite", "curator"],
    vibeTags: ["lively", "culinary", "creative"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.79,
    distinctivenessScore: 0.76,
    underexposureScore: 0.44,
    shareabilityScore: 0.81,
    isChain: false,
    shortDescription: "Food hall anchor with broad group-friendly optionality.",
    narrativeFlavor: "A reliable lively hinge for mixed groups in LoDo.",
    isHiddenGem: false,
    local: [0.76, 0.73, 0.74],
    roles: [0.46, 0.9, 0.71, 0.42]
  }),
  makeVenue({
    id: "de-commons-park-riverwalk",
    name: "Commons Park Riverwalk",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 10,
    category: "park",
    priceTier: "$",
    tags: ["riverwalk", "reset", "open-air", "walkable"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.74,
    distinctivenessScore: 0.72,
    underexposureScore: 0.62,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Riverfront walk with soft pacing near LoDo.",
    narrativeFlavor: "A clean cooldown/reset option that keeps downtown flexible.",
    isHiddenGem: false,
    local: [0.78, 0.81, 0.79],
    roles: [0.86, 0.38, 0.58, 0.95]
  }),
  makeVenue({
    id: "de-lodo-jazz-room",
    name: "LoDo Jazz Room",
    city: "Denver",
    neighborhood: "Downtown / LoDo",
    driveMinutes: 9,
    category: "live_music",
    priceTier: "$$",
    tags: ["jazz", "listening", "small-stage", "night"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["culture", "cozy", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.86,
    underexposureScore: 0.74,
    shareabilityScore: 0.73,
    isChain: false,
    shortDescription: "Intimate listening room with late-evening cultural pull.",
    narrativeFlavor: "A cultured highlight that avoids generic loudness.",
    isHiddenGem: true,
    local: [0.82, 0.86, 0.68],
    roles: [0.44, 0.87, 0.93, 0.62]
  }),
  makeVenue({
    id: "de-source-market-hall",
    name: "The Source Market Hall",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "event",
    priceTier: "$$",
    tags: ["market", "discovery", "cultural-flow", "local-only"],
    useCases: ["socialite", "curator"],
    vibeTags: ["creative", "culture", "lively"],
    energyLevel: 3,
    uniquenessScore: 0.9,
    distinctivenessScore: 0.91,
    underexposureScore: 0.77,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Curated market hall with strong local-maker identity.",
    narrativeFlavor: "A discovery-first RiNo anchor with layered options.",
    isHiddenGem: true,
    local: [0.88, 0.9, 0.72],
    roles: [0.72, 0.9, 0.95, 0.66]
  }),
  makeVenue({
    id: "de-rino-central-market",
    name: "RiNo Central Market",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "event",
    priceTier: "$$",
    tags: ["food-hall", "discovery", "walkable", "social"],
    useCases: ["socialite", "curator"],
    vibeTags: ["culinary", "creative", "lively"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.8,
    underexposureScore: 0.58,
    shareabilityScore: 0.85,
    isChain: false,
    shortDescription: "RiNo food hall with casual hopping between micro-vendors.",
    narrativeFlavor: "A flexible lively anchor for friend-led flows.",
    isHiddenGem: false,
    local: [0.8, 0.78, 0.74],
    roles: [0.58, 0.9, 0.81, 0.53]
  }),
  makeVenue({
    id: "de-improper-city",
    name: "Improper City Yard",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$",
    tags: ["patio", "social", "event", "outdoor"],
    useCases: ["socialite"],
    vibeTags: ["lively", "outdoors", "creative"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.81,
    distinctivenessScore: 0.79,
    underexposureScore: 0.52,
    shareabilityScore: 0.87,
    isChain: false,
    shortDescription: "Large patio social anchor with rotating events.",
    narrativeFlavor: "A momentum-heavy RiNo peak for lively crews.",
    isHiddenGem: false,
    local: [0.79, 0.78, 0.75],
    roles: [0.34, 0.94, 0.78, 0.36]
  }),
  makeVenue({
    id: "de-death-co-rino",
    name: "Death & Co RiNo",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$$",
    tags: ["cocktails", "intimate", "conversation", "signature"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "creative", "culinary"],
    energyLevel: 3,
    socialDensity: 3,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.9,
    underexposureScore: 0.68,
    shareabilityScore: 0.89,
    isChain: false,
    shortDescription: "Focused cocktail room with craft-forward identity.",
    narrativeFlavor: "A signature peak that keeps RiNo distinct.",
    isHiddenGem: false,
    local: [0.84, 0.83, 0.71],
    roles: [0.46, 0.92, 0.66, 0.72]
  }),
  makeVenue({
    id: "de-rino-art-alley",
    name: "RiNo Art Alley Walk",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "activity",
    priceTier: "$",
    tags: ["murals", "discovery", "movement", "cultural-flow"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["creative", "culture", "outdoors"],
    energyLevel: 2,
    uniquenessScore: 0.94,
    distinctivenessScore: 0.95,
    underexposureScore: 0.9,
    shareabilityScore: 0.95,
    isChain: false,
    shortDescription: "Mural-lined route with strong discovery and photo moments.",
    narrativeFlavor: "A high-distinctiveness movement anchor for RiNo.",
    isHiddenGem: true,
    local: [0.9, 0.94, 0.7],
    roles: [0.84, 0.72, 0.98, 0.82]
  }),
  makeVenue({
    id: "de-ratio-beerworks",
    name: "Ratio Beerworks",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$",
    tags: ["local", "beer", "social", "event-friendly"],
    useCases: ["socialite"],
    vibeTags: ["lively", "creative", "culture"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.77,
    underexposureScore: 0.57,
    shareabilityScore: 0.79,
    isChain: false,
    shortDescription: "Local beer anchor with energetic neighborhood flow.",
    narrativeFlavor: "A practical lively support venue in the RiNo pocket.",
    isHiddenGem: false,
    local: [0.77, 0.8, 0.8],
    roles: [0.31, 0.88, 0.71, 0.38]
  }),
  makeVenue({
    id: "de-huckleberry-rino",
    name: "Huckleberry Roasters RiNo",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "warmup", "local", "low-noise"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "creative", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.81,
    underexposureScore: 0.67,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Coffee-forward warmup stop with calmer pacing.",
    narrativeFlavor: "A soft entry point before RiNo discovery momentum.",
    isHiddenGem: true,
    local: [0.82, 0.84, 0.76],
    roles: [0.92, 0.43, 0.55, 0.85]
  }),
  makeVenue({
    id: "de-rino-craft-gelato",
    name: "RiNo Craft Gelato",
    city: "Denver",
    neighborhood: "RiNo",
    driveMinutes: 11,
    category: "dessert",
    priceTier: "$$",
    tags: ["dessert", "local", "shareable", "cooldown"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["cozy", "culinary", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.82,
    underexposureScore: 0.71,
    shareabilityScore: 0.9,
    isChain: false,
    shortDescription: "Small-batch dessert stop that softens the end of the arc.",
    narrativeFlavor: "A sweet cooldown for layered RiNo sequences.",
    isHiddenGem: true,
    local: [0.8, 0.83, 0.77],
    roles: [0.66, 0.58, 0.62, 0.94]
  }),
  makeVenue({
    id: "de-aviano-cherry-creek",
    name: "Aviano Coffee Cherry Creek",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 13,
    category: "cafe",
    priceTier: "$$",
    tags: ["coffee", "intimate", "linger", "neighborhood"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culinary", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.81,
    distinctivenessScore: 0.79,
    underexposureScore: 0.6,
    shareabilityScore: 0.73,
    isChain: false,
    shortDescription: "Neighborhood coffee anchor with slower pacing.",
    narrativeFlavor: "A soft starter for Cherry Creek cozy flows.",
    isHiddenGem: false,
    local: [0.8, 0.81, 0.79],
    roles: [0.93, 0.39, 0.46, 0.84]
  }),
  makeVenue({
    id: "de-local-jones",
    name: "Local Jones Dining",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 14,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["neighborhood", "conversation", "slow-dining", "chef-led"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "cozy", "culture"],
    energyLevel: 3,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.78,
    underexposureScore: 0.52,
    shareabilityScore: 0.81,
    isChain: false,
    shortDescription: "Polished neighborhood dining with conversation-friendly pacing.",
    narrativeFlavor: "A reliable dinner anchor for Cherry Creek evening arcs.",
    isHiddenGem: false,
    local: [0.79, 0.76, 0.75],
    roles: [0.58, 0.88, 0.43, 0.5]
  }),
  makeVenue({
    id: "de-cherry-creek-trail-loop",
    name: "Cherry Creek Trail Loop",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 14,
    category: "park",
    priceTier: "$",
    tags: ["trail", "walkable", "reset", "open-air"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.77,
    distinctivenessScore: 0.75,
    underexposureScore: 0.64,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Scenic trail segment that supports low-friction transitions.",
    narrativeFlavor: "A clean reset lane inside Cherry Creek plans.",
    isHiddenGem: false,
    local: [0.82, 0.86, 0.8],
    roles: [0.86, 0.34, 0.54, 0.95]
  }),
  makeVenue({
    id: "de-cherry-creek-art-walk",
    name: "Cherry Creek North Art Walk",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 13,
    category: "activity",
    priceTier: "$",
    tags: ["gallery", "walkable", "curated", "discovery"],
    useCases: ["romantic", "curator"],
    vibeTags: ["culture", "creative", "relaxed"],
    energyLevel: 2,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.85,
    underexposureScore: 0.75,
    shareabilityScore: 0.83,
    isChain: false,
    shortDescription: "Compact gallery loop with approachable cultural depth.",
    narrativeFlavor: "A cultured connector that keeps Cherry Creek intentional.",
    isHiddenGem: true,
    local: [0.81, 0.86, 0.73],
    roles: [0.8, 0.69, 0.88, 0.83]
  }),
  makeVenue({
    id: "de-forget-me-not-wine",
    name: "Forget Me Not Wine Room",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 14,
    category: "bar",
    priceTier: "$$$",
    tags: ["wine", "intimate", "conversation", "slow"],
    useCases: ["romantic"],
    vibeTags: ["cozy", "culinary", "culture"],
    energyLevel: 2,
    socialDensity: 2,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.82,
    underexposureScore: 0.69,
    shareabilityScore: 0.76,
    isChain: false,
    shortDescription: "Low-noise wine room suited for slower evening pacing.",
    narrativeFlavor: "A romantic anchor that preserves Cherry Creek softness.",
    isHiddenGem: true,
    local: [0.79, 0.83, 0.74],
    roles: [0.46, 0.78, 0.55, 0.88]
  }),
  makeVenue({
    id: "de-matsuhisa-cherry-creek",
    name: "Matsuhisa Cherry Creek",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 15,
    category: "restaurant",
    priceTier: "$$$$",
    tags: ["japanese", "chef-led", "signature", "special-occasion"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "culture", "cozy"],
    energyLevel: 3,
    uniquenessScore: 0.85,
    distinctivenessScore: 0.84,
    underexposureScore: 0.5,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "High-polish Japanese dining with strong occasion value.",
    narrativeFlavor: "A premium anchor that still fits Cherry Creek pacing.",
    isHiddenGem: false,
    local: [0.77, 0.75, 0.71],
    roles: [0.52, 0.9, 0.45, 0.44]
  }),
  makeVenue({
    id: "de-noisette-confectionery",
    name: "Noisette Confectionery",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 13,
    category: "dessert",
    priceTier: "$$",
    tags: ["pastry", "confectionary", "shareable", "calm"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "culinary", "relaxed"],
    energyLevel: 1,
    uniquenessScore: 0.86,
    distinctivenessScore: 0.87,
    underexposureScore: 0.78,
    shareabilityScore: 0.92,
    isChain: false,
    shortDescription: "Fine pastry stop with strong cooldown usefulness.",
    narrativeFlavor: "A soft ending move for Cherry Creek cozy/cultured arcs.",
    isHiddenGem: true,
    local: [0.83, 0.87, 0.76],
    roles: [0.79, 0.58, 0.62, 0.97]
  }),
  makeVenue({
    id: "de-cherry-creek-fresh-market",
    name: "Cherry Creek Fresh Market Plaza",
    city: "Denver",
    neighborhood: "Cherry Creek",
    driveMinutes: 14,
    category: "event",
    priceTier: "$$",
    tags: ["market", "local", "walkable", "discovery"],
    useCases: ["socialite", "curator"],
    vibeTags: ["culture", "outdoors", "creative"],
    energyLevel: 3,
    uniquenessScore: 0.81,
    distinctivenessScore: 0.8,
    underexposureScore: 0.72,
    shareabilityScore: 0.82,
    isChain: false,
    shortDescription: "Neighborhood market node with local food and makers.",
    narrativeFlavor: "A discovery layer that broadens Cherry Creek options.",
    isHiddenGem: true,
    local: [0.82, 0.86, 0.72],
    roles: [0.68, 0.82, 0.9, 0.62]
  }),
  makeVenue({
    id: "de-little-man-ice-cream",
    name: "Little Man Ice Cream",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "dessert",
    priceTier: "$$",
    tags: ["dessert", "local-icon", "shareable", "line-energy"],
    useCases: ["romantic", "socialite", "curator"],
    vibeTags: ["playful", "cozy", "culinary"],
    energyLevel: 3,
    uniquenessScore: 0.88,
    distinctivenessScore: 0.9,
    underexposureScore: 0.65,
    shareabilityScore: 0.95,
    isChain: false,
    shortDescription: "Neighborhood icon dessert stop with social-friendly momentum.",
    narrativeFlavor: "A signature LoHi moment with high shareability.",
    isHiddenGem: false,
    local: [0.86, 0.9, 0.8],
    roles: [0.66, 0.83, 0.69, 0.94]
  }),
  makeVenue({
    id: "de-linger-lohi",
    name: "Linger LoHi",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "restaurant",
    priceTier: "$$$",
    tags: ["rooftop", "social", "signature", "dinner"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["culinary", "lively", "creative"],
    energyLevel: 4,
    uniquenessScore: 0.84,
    distinctivenessScore: 0.83,
    underexposureScore: 0.55,
    shareabilityScore: 0.89,
    isChain: false,
    shortDescription: "Popular LoHi dinner anchor with skyline-forward feel.",
    narrativeFlavor: "A high-confidence highlight for Highlands outings.",
    isHiddenGem: false,
    local: [0.8, 0.79, 0.76],
    roles: [0.41, 0.93, 0.54, 0.45]
  }),
  makeVenue({
    id: "de-williams-graham",
    name: "Williams & Graham",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "bar",
    priceTier: "$$$",
    tags: ["cocktails", "intimate", "conversation", "speakeasy"],
    useCases: ["romantic", "socialite"],
    vibeTags: ["cozy", "creative", "culinary"],
    energyLevel: 3,
    socialDensity: 3,
    uniquenessScore: 0.87,
    distinctivenessScore: 0.9,
    underexposureScore: 0.7,
    shareabilityScore: 0.86,
    isChain: false,
    shortDescription: "Small cocktail room with higher intimacy than typical nightlife.",
    narrativeFlavor: "A signature LoHi anchor that preserves conversation quality.",
    isHiddenGem: false,
    local: [0.84, 0.86, 0.73],
    roles: [0.43, 0.9, 0.63, 0.79]
  }),
  makeVenue({
    id: "de-lohi-bridge-stroll",
    name: "LoHi Bridge Stroll",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "activity",
    priceTier: "$",
    tags: ["walkable", "bridge-view", "movement", "reset"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.8,
    distinctivenessScore: 0.8,
    underexposureScore: 0.68,
    shareabilityScore: 0.84,
    isChain: false,
    shortDescription: "Short scenic stroll linking LoHi anchors.",
    narrativeFlavor: "A low-friction movement lane for Highlands sequences.",
    isHiddenGem: true,
    local: [0.83, 0.88, 0.78],
    roles: [0.84, 0.61, 0.95, 0.87]
  }),
  makeVenue({
    id: "de-avanti-lohi",
    name: "Avanti LoHi Collective",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "event",
    priceTier: "$$",
    tags: ["food-hall", "rooftop", "social", "event"],
    useCases: ["socialite"],
    vibeTags: ["lively", "culinary", "creative"],
    energyLevel: 4,
    socialDensity: 4,
    uniquenessScore: 0.82,
    distinctivenessScore: 0.79,
    underexposureScore: 0.5,
    shareabilityScore: 0.88,
    isChain: false,
    shortDescription: "Rooftop food hall with event-style neighborhood energy.",
    narrativeFlavor: "A broad, lively support anchor inside LoHi.",
    isHiddenGem: false,
    local: [0.79, 0.77, 0.74],
    roles: [0.45, 0.92, 0.83, 0.4]
  }),
  makeVenue({
    id: "de-highlands-square-cafe",
    name: "Highlands Square Cafe",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 13,
    category: "cafe",
    priceTier: "$$",
    tags: ["neighborhood", "coffee", "low-noise", "linger"],
    useCases: ["romantic", "curator"],
    vibeTags: ["cozy", "relaxed", "culture"],
    energyLevel: 2,
    uniquenessScore: 0.78,
    distinctivenessScore: 0.76,
    underexposureScore: 0.65,
    shareabilityScore: 0.71,
    isChain: false,
    shortDescription: "Calmer neighborhood cafe suited to warmup and reset roles.",
    narrativeFlavor: "A soft support venue that improves LoHi arc shape.",
    isHiddenGem: true,
    local: [0.8, 0.84, 0.8],
    roles: [0.9, 0.38, 0.49, 0.9]
  }),
  makeVenue({
    id: "de-confluence-overlook-park",
    name: "Confluence Overlook Park",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "park",
    priceTier: "$",
    tags: ["open-air", "reset", "stroll", "river"],
    useCases: ["romantic", "curator"],
    vibeTags: ["outdoors", "relaxed", "cozy"],
    energyLevel: 1,
    uniquenessScore: 0.76,
    distinctivenessScore: 0.73,
    underexposureScore: 0.66,
    shareabilityScore: 0.78,
    isChain: false,
    shortDescription: "Riverside park reset with easy transitions into LoHi dining.",
    narrativeFlavor: "A cooldown-friendly anchor for softer Highlands flows.",
    isHiddenGem: false,
    local: [0.81, 0.87, 0.82],
    roles: [0.85, 0.33, 0.57, 0.97]
  }),
  makeVenue({
    id: "de-lohi-acoustic-room",
    name: "LoHi Acoustic Room",
    city: "Denver",
    neighborhood: "Highlands / LoHi",
    driveMinutes: 12,
    category: "live_music",
    priceTier: "$$",
    tags: ["acoustic", "small-stage", "listening", "intimate"],
    useCases: ["romantic", "curator", "socialite"],
    vibeTags: ["culture", "cozy", "creative"],
    energyLevel: 2,
    uniquenessScore: 0.83,
    distinctivenessScore: 0.85,
    underexposureScore: 0.77,
    shareabilityScore: 0.74,
    isChain: false,
    shortDescription: "Small-room performances with strong conversation compatibility.",
    narrativeFlavor: "A cultured support highlight that keeps LoHi specific.",
    isHiddenGem: true,
    local: [0.82, 0.86, 0.69],
    roles: [0.47, 0.78, 0.9, 0.7]
  })
];
var curatedVenues = [...sanJoseVenues, ...denverVenues];

// src/domain/retrieval/getTimeWindowSignal.ts
function getPhaseFromHour(hour) {
  if (hour < 11) {
    return "morning";
  }
  if (hour < 17) {
    return "afternoon";
  }
  if (hour < 22) {
    return "evening";
  }
  return "late-night";
}
function parseHourFromTimeWindow(timeWindow) {
  if (!timeWindow) {
    return void 0;
  }
  const normalized = timeWindow.trim().toLowerCase();
  const directMatches = [
    [["breakfast", "morning", "coffee"], 9],
    [["brunch", "lunch", "daytime", "afternoon"], 13],
    [["sunset", "dinner", "evening", "date-night"], 19],
    [["late-night", "nightcap", "after-dark", "night"], 22]
  ];
  for (const [candidates, hour2] of directMatches) {
    if (candidates.some((candidate) => normalized.includes(candidate))) {
      return hour2;
    }
  }
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) {
    return void 0;
  }
  let hour = Number(match[1]);
  const meridiem = match[3];
  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }
  return Math.max(0, Math.min(23, hour));
}
function getTimeWindowSignal(intent) {
  const now = /* @__PURE__ */ new Date();
  const parsedHour = parseHourFromTimeWindow(intent.timeWindow);
  const hour = parsedHour ?? now.getHours();
  const minute = parsedHour === void 0 ? now.getMinutes() : 0;
  const phase = getPhaseFromHour(hour);
  return {
    day: now.getDay(),
    hour,
    minute,
    phase,
    label: parsedHour === void 0 ? `${phase} now` : intent.timeWindow?.trim() || phase,
    usesIntentWindow: parsedHour !== void 0
  };
}

// src/domain/sources/buildLiveQueryPlan.ts
function normalizeTerm(value) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}
function unique2(values) {
  return [...new Set(values.filter(Boolean))];
}
function pickStarterPackTerms(starterPack) {
  const preferred = starterPack?.lensPreset?.preferredTags ?? [];
  return unique2(preferred.slice(0, 3).map(normalizeTerm).filter((value) => value.length >= 4));
}
function getPersonaTerms(intent) {
  if (intent.crew === "romantic") {
    return ["intimate", "date night", "conversation"];
  }
  if (intent.crew === "socialite") {
    return ["social", "cocktail", "lively"];
  }
  return ["welcoming", "casual", "comfortable"];
}
function getVibeTerms(intent) {
  const primary = intent.primaryAnchor;
  if (primary === "cozy") {
    return ["cozy", "quiet", "warm"];
  }
  if (primary === "lively") {
    return ["lively", "buzzing", "energetic"];
  }
  if (primary === "cultured") {
    return ["thoughtful", "design forward", "local culture"];
  }
  if (primary === "chill") {
    return ["relaxed", "easygoing", "neighborhood"];
  }
  if (primary === "playful") {
    return ["fun", "playful", "social"];
  }
  if (primary === "adventurous-urban") {
    return ["local", "under the radar", "neighborhood"];
  }
  return ["scenic", "open air", "local"];
}
function buildLocationLabel(intent) {
  return intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city;
}
function buildQueryText(kind, descriptors, locationLabel) {
  const phrase = unique2(descriptors).slice(0, 4).join(" ");
  return `${phrase} ${kind} in ${locationLabel}`.trim();
}
function buildLiveQueryPlan(intent, starterPack) {
  const locationLabel = buildLocationLabel(intent);
  const timeSignal = getTimeWindowSignal(intent);
  const personaTerms = getPersonaTerms(intent);
  const vibeTerms = getVibeTerms(intent);
  const starterPackTerms = pickStarterPackTerms(starterPack);
  const dateOrSocialTerms = intent.crew === "romantic" ? ["wine", "dessert"] : intent.crew === "socialite" ? ["cocktail", "group friendly"] : ["coffee", "daytime"];
  const startKind = timeSignal.phase === "morning" || timeSignal.phase === "afternoon" ? "cafe" : "restaurant";
  const highlightKind = timeSignal.phase === "late-night" || intent.primaryAnchor === "lively" || intent.crew === "socialite" ? "bar" : "restaurant";
  const windDownKind = timeSignal.phase === "late-night" ? "bar" : "cafe";
  const cultureKind = intent.primaryAnchor === "cultured" || intent.crew === "curator" ? "museum" : "activity";
  const strollKind = intent.primaryAnchor === "cozy" || intent.primaryAnchor === "chill" ? "park" : "activity";
  const plan = [
    {
      kind: startKind,
      roleHint: "start",
      label: "start-intent",
      template: "start-role-aware",
      queryTerms: unique2([
        "start",
        ...personaTerms.slice(0, 2),
        ...vibeTerms.slice(0, 2),
        ...startKind === "cafe" ? ["coffee", "brunch", "easy"] : ["lighter", "easy"],
        ...starterPackTerms.slice(0, 2)
      ]),
      notes: [
        `Start query favors easier openings for ${timeSignal.label}.`,
        startKind === "cafe" ? "Start query leans toward cafes and lighter coffee-led openings." : "Start query leans toward lighter restaurants with lower-friction entry."
      ],
      textQuery: ""
    },
    {
      kind: highlightKind,
      roleHint: "highlight",
      label: "highlight-intent",
      template: "highlight-role-aware",
      queryTerms: unique2([
        "highlight",
        ...personaTerms,
        ...vibeTerms,
        ...dateOrSocialTerms,
        ...highlightKind === "bar" ? ["cocktail", "stylish", "night"] : ["restaurant", "chef led", "intimate"],
        ...starterPackTerms
      ]),
      notes: [
        "Highlight query aims for anchor-grade restaurant/bar candidates.",
        highlightKind === "bar" ? "Highlight query emphasizes nightlife and social anchor strength." : "Highlight query emphasizes dinner and date-centered anchor strength."
      ],
      textQuery: ""
    },
    {
      kind: windDownKind,
      roleHint: "windDown",
      label: "wind-down-intent",
      template: "wind-down-role-aware",
      queryTerms: unique2([
        "wind down",
        "quiet",
        "conversation",
        ...windDownKind === "bar" ? ["wine", "nightcap"] : ["dessert", "tea", "coffee"],
        ...vibeTerms.slice(0, 2),
        ...starterPackTerms.slice(0, 2)
      ]),
      notes: [
        "Wind-down query favors calmer endings and softer support candidates.",
        windDownKind === "bar" ? "Wind-down query allows quieter bars or wine-forward nightcaps." : "Wind-down query favors cafes and dessert-adjacent soft landings."
      ],
      textQuery: ""
    },
    {
      kind: highlightKind,
      roleHint: "support",
      label: "neighborhood-broad",
      template: "context-broad",
      queryTerms: unique2([
        ...personaTerms.slice(0, 2),
        ...vibeTerms.slice(0, 2),
        "neighborhood",
        "local",
        ...starterPackTerms.slice(0, 1)
      ]),
      notes: ["Broad neighborhood query keeps a small fallback layer of context-matched live candidates."],
      textQuery: ""
    },
    {
      kind: cultureKind,
      roleHint: "support",
      label: "culture-discovery",
      template: "culture-support",
      queryTerms: unique2([
        "local",
        "cultural",
        "discovery",
        ...cultureKind === "museum" ? ["museum", "gallery", "historic"] : ["activity", "community", "art"],
        ...starterPackTerms.slice(0, 2)
      ]),
      notes: ["Culture support query expands retrieval into district-identity shaping venues."],
      textQuery: ""
    },
    {
      kind: strollKind,
      roleHint: "support",
      label: "walkable-support",
      template: "walkability-support",
      queryTerms: unique2([
        "walkable",
        "neighborhood",
        "local",
        ...strollKind === "park" ? ["park", "trail", "open air"] : ["plaza", "market", "district"],
        ...vibeTerms.slice(0, 1)
      ]),
      notes: ["Walkability support query broadens non-dining anchors for district sequencing."],
      textQuery: ""
    },
    {
      kind: "dessert",
      roleHint: "windDown",
      label: "dessert-winddown",
      template: "winddown-dessert",
      queryTerms: unique2([
        "dessert",
        "sweet",
        "shareable",
        "nightcap",
        ...vibeTerms.slice(0, 1)
      ]),
      notes: ["Dessert query provides softer end-of-route anchors when available."],
      textQuery: ""
    }
  ];
  const withText = plan.map((entry) => ({
    ...entry,
    textQuery: buildQueryText(entry.kind, entry.queryTerms, locationLabel)
  }));
  const deduped = /* @__PURE__ */ new Map();
  for (const entry of withText) {
    const key = `${entry.kind}:${entry.textQuery.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }
  return [...deduped.values()];
}

// src/domain/sources/getSourceMode.ts
function getProcessEnvValue(key) {
  const processEnv = globalThis.process?.env;
  return processEnv?.[key];
}
function getGooglePlacesConfig() {
  const env = import.meta.env ?? {};
  return {
    apiKey: env.VITE_GOOGLE_PLACES_API_KEY ?? getProcessEnvValue("VITE_GOOGLE_PLACES_API_KEY"),
    endpoint: env.VITE_GOOGLE_PLACES_ENDPOINT ?? getProcessEnvValue("VITE_GOOGLE_PLACES_ENDPOINT") ?? "https://places.googleapis.com/v1/places:searchText",
    languageCode: env.VITE_GOOGLE_PLACES_LANGUAGE_CODE ?? getProcessEnvValue("VITE_GOOGLE_PLACES_LANGUAGE_CODE") ?? "en",
    regionCode: env.VITE_GOOGLE_PLACES_REGION_CODE ?? getProcessEnvValue("VITE_GOOGLE_PLACES_REGION_CODE") ?? "US",
    pageSize: Number(
      env.VITE_GOOGLE_PLACES_PAGE_SIZE ?? getProcessEnvValue("VITE_GOOGLE_PLACES_PAGE_SIZE") ?? 8
    ),
    queryRadiusM: Number(
      env.VITE_GOOGLE_PLACES_QUERY_RADIUS_M ?? getProcessEnvValue("VITE_GOOGLE_PLACES_QUERY_RADIUS_M") ?? 3200
    ),
    centerOffsetM: Number(
      env.VITE_GOOGLE_PLACES_CENTER_OFFSET_M ?? getProcessEnvValue("VITE_GOOGLE_PLACES_CENTER_OFFSET_M") ?? 2400
    ),
    maxCenters: Number(
      env.VITE_GOOGLE_PLACES_MAX_CENTERS ?? getProcessEnvValue("VITE_GOOGLE_PLACES_MAX_CENTERS") ?? 3
    )
  };
}

// src/domain/sources/mapLivePlaceToRawPlace.ts
var ignoredTypes = /* @__PURE__ */ new Set([
  "food",
  "establishment",
  "point-of-interest",
  "store",
  "tourist-attraction"
]);
function normalizeValue5(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function unique3(values) {
  return [...new Set(values)];
}
function mapHoursPeriods(periods) {
  if (!periods || periods.length === 0) {
    return void 0;
  }
  return periods.map((period) => ({
    open: period.open?.day === void 0 || period.open.hour === void 0 || period.open.minute === void 0 ? void 0 : {
      day: period.open.day,
      hour: period.open.hour,
      minute: period.open.minute
    },
    close: period.close?.day === void 0 || period.close.hour === void 0 || period.close.minute === void 0 ? void 0 : {
      day: period.close.day,
      hour: period.close.hour,
      minute: period.close.minute
    }
  })).filter((period) => period.open || period.close);
}
function getNormalizedTypes(place) {
  return unique3(
    [place.primaryType, ...place.types ?? []].filter((value) => Boolean(value)).map(normalizeValue5).filter((value) => !ignoredTypes.has(value))
  );
}
function hasAny2(values, candidates) {
  return candidates.some((candidate) => values.includes(candidate));
}
function resolveCategory(placeTypes, requestedKind) {
  if (hasAny2(placeTypes, ["bar", "cocktail-bar", "wine-bar", "pub", "brewery", "sports-bar"])) {
    return "bar";
  }
  if (hasAny2(placeTypes, ["cafe", "coffee-shop", "tea-house", "espresso-bar"])) {
    return "cafe";
  }
  if (hasAny2(placeTypes, [
    "dessert-shop",
    "ice-cream-shop",
    "bakery",
    "pastry-shop",
    "chocolate-shop"
  ])) {
    return "dessert";
  }
  if (hasAny2(placeTypes, ["museum", "art-gallery", "history-museum", "science-museum"])) {
    return "museum";
  }
  if (hasAny2(placeTypes, [
    "park",
    "national-park",
    "dog-park",
    "garden",
    "botanical-garden",
    "hiking-area",
    "trailhead",
    "state-park"
  ])) {
    return "park";
  }
  if (hasAny2(placeTypes, ["event-venue", "concert-hall", "amphitheater", "performing-arts-theater"])) {
    return "event";
  }
  if (hasAny2(placeTypes, [
    "movie-theater",
    "bowling-alley",
    "mini-golf-course",
    "escape-room-center",
    "arcade",
    "tourist-attraction"
  ])) {
    return "activity";
  }
  if (hasAny2(placeTypes, ["restaurant", "brunch-restaurant", "fine-dining-restaurant"]) || placeTypes.some((type) => type.endsWith("-restaurant"))) {
    return "restaurant";
  }
  if (hasAny2(placeTypes, ["fast-food-restaurant", "meal-takeaway", "meal-delivery"])) {
    return "restaurant";
  }
  if (requestedKind === "dessert") {
    return "dessert";
  }
  if (requestedKind === "museum") {
    return "museum";
  }
  if (requestedKind === "park") {
    return "park";
  }
  if (requestedKind === "activity") {
    return "activity";
  }
  return requestedKind;
}
function getAddressComponent(components, candidates) {
  return components?.find(
    (component) => component.types?.some((type) => candidates.includes(normalizeValue5(type)))
  )?.longText;
}
function inferNeighborhood(place, fallback) {
  const fromComponents = getAddressComponent(place.addressComponents, ["neighborhood"]) ?? getAddressComponent(place.addressComponents, ["sublocality-level-1", "sublocality"]) ?? getAddressComponent(place.addressComponents, ["postal-town"]);
  if (fromComponents) {
    return fromComponents;
  }
  const address = place.shortFormattedAddress ?? place.formattedAddress;
  if (!address) {
    return fallback;
  }
  const firstSegment = address.split(",")[0]?.trim();
  return firstSegment && firstSegment.length >= 3 ? firstSegment : fallback;
}
function inferCity(place, fallback) {
  return getAddressComponent(place.addressComponents, ["locality"]) ?? getAddressComponent(place.addressComponents, ["administrative-area-level-2"]) ?? fallback;
}
function mapPriceTier(priceLevel) {
  if (priceLevel === "PRICE_LEVEL_FREE" || priceLevel === "PRICE_LEVEL_INEXPENSIVE") {
    return "$";
  }
  if (priceLevel === "PRICE_LEVEL_MODERATE") {
    return "$$";
  }
  if (priceLevel === "PRICE_LEVEL_EXPENSIVE") {
    return "$$$";
  }
  if (priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE") {
    return "$$$$";
  }
  return "$$";
}
function inferSummaryKeywords(summary) {
  const normalized = summary.toLowerCase();
  const matches = [];
  const keywordMap = [
    ["patio", "outdoor-seating"],
    ["rooftop", "rooftop"],
    ["cocktail", "cocktails"],
    ["wine", "wine"],
    ["coffee", "coffee"],
    ["espresso", "espresso-bar"],
    ["tea", "tea-house"],
    ["brunch", "brunch"],
    ["dessert", "dessert"],
    ["intimate", "intimate"],
    ["cozy", "cozy"],
    ["craft", "craft"],
    ["local", "local"],
    ["seasonal", "seasonal"],
    ["chef", "chef-led"],
    ["quiet", "quiet"],
    ["lively", "social"]
  ];
  for (const [needle, tag] of keywordMap) {
    if (normalized.includes(needle)) {
      matches.push(tag);
    }
  }
  return matches;
}
function inferTags(placeTypes, summary, requestedKind, queryTerms) {
  const tags = new Set(placeTypes);
  tags.add(requestedKind);
  for (const tag of inferSummaryKeywords(summary)) {
    tags.add(tag);
  }
  for (const tag of queryTerms) {
    tags.add(normalizeValue5(tag));
  }
  return [...tags].slice(0, 10);
}
function inferIsChain(name, placeTypes, ratingCount, tags) {
  if (hasAny2(placeTypes, ["fast-food-restaurant", "meal-takeaway", "meal-delivery"])) {
    return true;
  }
  if (/#\d+/.test(name)) {
    return true;
  }
  const strongLocalSignal = tags.some(
    (tag) => ["local", "artisan", "chef-led", "craft", "seasonal", "intimate"].includes(tag)
  );
  return ratingCount >= 1800 && !strongLocalSignal && name.trim().split(/\s+/).length <= 2;
}
function inferDriveMinutes(context, placeNeighborhood) {
  const rankPenalty = Math.min(context.rank, 5);
  const normalizedIntentNeighborhood = context.neighborhood ? normalizeValue5(context.neighborhood) : void 0;
  const normalizedPlaceNeighborhood = placeNeighborhood ? normalizeValue5(placeNeighborhood) : void 0;
  const sameNeighborhood = Boolean(normalizedIntentNeighborhood) && Boolean(normalizedPlaceNeighborhood) && normalizedIntentNeighborhood === normalizedPlaceNeighborhood;
  let base = 11;
  if (context.requestedKind === "bar") {
    base = 10;
  } else if (context.requestedKind === "restaurant") {
    base = 12;
  } else if (context.requestedKind === "cafe") {
    base = 9;
  } else if (context.requestedKind === "dessert") {
    base = 9;
  } else if (context.requestedKind === "park") {
    base = 13;
  } else if (context.requestedKind === "museum") {
    base = 12;
  } else if (context.requestedKind === "activity") {
    base = 11;
  }
  if (sameNeighborhood) {
    base -= 3;
  }
  if (!placeNeighborhood) {
    base += 2;
  }
  return Math.max(6, Math.min(22, base + rankPenalty * 2));
}
function buildShortDescription(category, summary) {
  if (summary) {
    return summary;
  }
  if (category === "bar") {
    return "Live place result with bar-forward social energy.";
  }
  if (category === "cafe") {
    return "Live place result suited to a softer coffee or cafe stop.";
  }
  if (category === "dessert") {
    return "Live place result suited to a softer dessert or sweet stop.";
  }
  if (category === "park") {
    return "Live place result that can support a walkable reset moment.";
  }
  if (category === "museum") {
    return "Live place result with culturally distinct discovery utility.";
  }
  if (category === "activity" || category === "event") {
    return "Live place result with activity or event momentum potential.";
  }
  return "Live place result that fits the current dining slice.";
}
function buildNarrativeFlavor(category, tags) {
  if (category === "bar") {
    return tags.includes("intimate") ? "A live-discovered bar with enough signal to support a focused social moment." : "A live-discovered bar that can supplement the current route without overpowering it.";
  }
  if (category === "cafe") {
    return "A live-discovered cafe that reads as a plausible opening or wind-down move.";
  }
  if (category === "dessert") {
    return "A live-discovered dessert lane that can land a route with softer pacing.";
  }
  if (category === "park") {
    return "A live-discovered park lane that improves reset and movement flow in sequence.";
  }
  if (category === "museum") {
    return "A live-discovered cultural venue with discovery-forward district value.";
  }
  if (category === "activity" || category === "event") {
    return "A live-discovered activity lane that can add momentum without dominating the route.";
  }
  return "A live-discovered restaurant with enough structured signal to enter the route pool safely.";
}
function inferSourceConfidence(place, tags, neighborhood, requestedKind) {
  const summaryPresent = Boolean(place.editorialSummary?.text);
  const rating = place.rating ?? 0;
  const ratingCount = place.userRatingCount ?? 0;
  const ratingCountScore = Math.min(ratingCount / 650, 1);
  const neighborhoodScore = neighborhood ? 0.08 : 0;
  const summaryScore = summaryPresent ? 0.12 : 0;
  const typeScore = Math.min(tags.length / 10, 1) * 0.14;
  const websiteScore = place.websiteUri ? 0.05 : 0;
  const hoursScore = (place.currentOpeningHours?.weekdayDescriptions?.length ?? 0) > 0 || (place.regularOpeningHours?.weekdayDescriptions?.length ?? 0) > 0 ? 0.05 : 0;
  const kindAlignmentScore = requestedKind && tags.includes(requestedKind) ? 0.03 : 0;
  return Number(
    Math.max(
      0.48,
      Math.min(
        0.94,
        0.5 + rating / 10 + ratingCountScore * 0.18 + neighborhoodScore + summaryScore + typeScore + websiteScore + hoursScore + kindAlignmentScore
      )
    ).toFixed(2)
  );
}
function mapLivePlaceToRawPlaceWithDiagnostics(place, context) {
  const name = place.displayName?.text?.trim();
  const placeId = place.id?.trim();
  if (!name) {
    return { dropReason: "missing_name" };
  }
  if (!placeId) {
    return { dropReason: "missing_place_id" };
  }
  const placeTypes = getNormalizedTypes(place);
  const category = resolveCategory(placeTypes, context.requestedKind);
  if (!category) {
    return { dropReason: "unsupported_category" };
  }
  const summary = place.editorialSummary?.text?.trim() ?? "";
  const neighborhood = inferNeighborhood(place, context.neighborhood);
  const city = inferCity(place, context.city);
  const tags = inferTags(placeTypes, summary, context.requestedKind, context.queryTerms);
  const ratingCount = place.userRatingCount ?? 0;
  const isChain = inferIsChain(name, placeTypes, ratingCount, tags);
  const sourceConfidence = inferSourceConfidence(place, tags, neighborhood, context.requestedKind);
  return {
    rawPlace: {
      rawType: "place",
      id: `live_google_${placeId}`,
      name,
      city,
      neighborhood: neighborhood ?? context.city,
      driveMinutes: inferDriveMinutes(context, neighborhood),
      priceTier: mapPriceTier(place.priceLevel),
      tags,
      shortDescription: buildShortDescription(category, summary),
      narrativeFlavor: buildNarrativeFlavor(category, tags),
      imageUrl: "",
      categoryHint: category,
      subcategoryHint: placeTypes[0] ?? context.requestedKind,
      placeTypes,
      sourceTypes: placeTypes,
      normalizedFromRawType: "raw-place",
      sourceOrigin: "live",
      provider: "google-places",
      providerRecordId: placeId,
      sourceQueryLabel: context.queryLabel,
      queryTerms: context.queryTerms,
      sourceConfidence,
      isChain,
      formattedAddress: place.formattedAddress,
      rating: place.rating,
      ratingCount,
      openNow: place.currentOpeningHours?.openNow,
      businessStatus: place.businessStatus,
      hoursPeriods: mapHoursPeriods(place.currentOpeningHours?.periods) ?? mapHoursPeriods(place.regularOpeningHours?.periods),
      currentOpeningHoursText: place.currentOpeningHours?.weekdayDescriptions,
      regularOpeningHoursText: place.regularOpeningHours?.weekdayDescriptions,
      utcOffsetMinutes: place.utcOffsetMinutes,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude
    }
  };
}

// src/domain/sources/fetchLivePlaces.ts
var googleFieldMask = [
  "places.id",
  "places.displayName",
  "places.primaryType",
  "places.types",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.addressComponents",
  "places.editorialSummary",
  "places.businessStatus",
  "places.currentOpeningHours.openNow",
  "places.currentOpeningHours.weekdayDescriptions",
  "places.currentOpeningHours.periods",
  "places.priceLevel",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.regularOpeningHours.periods",
  "places.rating",
  "places.userRatingCount",
  "places.utcOffsetMinutes",
  "places.websiteUri",
  "places.location"
].join(",");
var KNOWN_CITY_CENTERS = {
  "san jose": { lat: 37.3382, lng: -121.8863 },
  denver: { lat: 39.7392, lng: -104.9903 },
  austin: { lat: 30.2672, lng: -97.7431 }
};
function normalizeCity(value) {
  const normalized = value.trim().toLowerCase().replace(/\./g, "");
  const [head] = normalized.split(",");
  return (head ?? normalized).replace(/\s+/g, " ").trim();
}
function hashString2(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function hashToUnit(value) {
  return hashString2(value) / 4294967295;
}
function getCityCenter(city) {
  const cityKey = normalizeCity(city);
  const known = KNOWN_CITY_CENTERS[cityKey];
  if (known) {
    return known;
  }
  const lat = 30.5 + hashToUnit(`${cityKey}:lat`) * 11.5;
  const lng = -121.5 + hashToUnit(`${cityKey}:lng`) * 23.5;
  return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
}
function metersToLatDegrees(meters) {
  return meters / 111320;
}
function metersToLngDegrees(meters, latitude) {
  const latRadians = latitude * Math.PI / 180;
  const metersPerDegree = 111320 * Math.max(0.2, Math.cos(latRadians));
  return meters / metersPerDegree;
}
function deriveQueryCenters(city, maxCenters, offsetM) {
  const center = getCityCenter(city);
  const latOffset = metersToLatDegrees(offsetM);
  const lngOffset = metersToLngDegrees(offsetM, center.lat);
  const allCenters = [
    {
      id: "core",
      lat: Number(center.lat.toFixed(5)),
      lng: Number(center.lng.toFixed(5))
    },
    {
      id: "north",
      lat: Number((center.lat + latOffset).toFixed(5)),
      lng: Number(center.lng.toFixed(5))
    },
    {
      id: "east",
      lat: Number(center.lat.toFixed(5)),
      lng: Number((center.lng + lngOffset).toFixed(5))
    },
    {
      id: "south",
      lat: Number((center.lat - latOffset).toFixed(5)),
      lng: Number(center.lng.toFixed(5))
    },
    {
      id: "west",
      lat: Number(center.lat.toFixed(5)),
      lng: Number((center.lng - lngOffset).toFixed(5))
    }
  ];
  return allCenters.slice(0, Math.max(1, Math.min(5, maxCenters)));
}
async function runQueryPlanInBatches(queryPlan) {
  const settled = [];
  const batchSize = 6;
  for (let index = 0; index < queryPlan.length; index += batchSize) {
    const batch = queryPlan.slice(index, index + batchSize);
    const batchSettled = await Promise.allSettled(
      batch.map(async (query) => ({
        query,
        places: await queryGooglePlacesTextSearch({
          kind: query.kind,
          textQuery: query.textQuery,
          center: query.center,
          radiusM: query.radiusM
        })
      }))
    );
    settled.push(...batchSettled);
  }
  return settled;
}
function countByGateStatus(venues, status) {
  return venues.filter((venue) => venue.source.qualityGateStatus === status).length;
}
function emptyMapDropReasons() {
  return {
    missing_name: 0,
    missing_place_id: 0,
    unsupported_category: 0
  };
}
function incrementBucket(counter, key) {
  counter[key] = (counter[key] ?? 0) + 1;
}
function formatLocationLabel(intent) {
  return intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city;
}
async function queryGooglePlacesTextSearch(query) {
  const config = getGooglePlacesConfig();
  if (!config.apiKey) {
    throw new Error("Missing VITE_GOOGLE_PLACES_API_KEY.");
  }
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.apiKey,
      "X-Goog-FieldMask": googleFieldMask
    },
    body: JSON.stringify({
      textQuery: query.textQuery,
      pageSize: config.pageSize,
      languageCode: config.languageCode,
      regionCode: config.regionCode,
      rankPreference: "RELEVANCE",
      locationBias: {
        circle: {
          center: {
            latitude: query.center.lat,
            longitude: query.center.lng
          },
          radius: query.radiusM
        }
      }
    })
  });
  if (!response.ok) {
    throw new Error(`${query.kind} query failed (${response.status})`);
  }
  const payload = await response.json();
  return (payload.places ?? []).filter(
    (place) => place.businessStatus !== "CLOSED_PERMANENTLY"
  );
}
function gateStatusRank(status) {
  if (status === "approved") {
    return 3;
  }
  if (status === "demoted") {
    return 2;
  }
  return 1;
}
function compareVenueQuality(left, right) {
  const gateDelta = gateStatusRank(left.source.qualityGateStatus) - gateStatusRank(right.source.qualityGateStatus);
  if (gateDelta !== 0) {
    return gateDelta;
  }
  if (left.source.qualityScore !== right.source.qualityScore) {
    return left.source.qualityScore - right.source.qualityScore;
  }
  if (left.source.sourceConfidence !== right.source.sourceConfidence) {
    return left.source.sourceConfidence - right.source.sourceConfidence;
  }
  if (left.source.completenessScore !== right.source.completenessScore) {
    return left.source.completenessScore - right.source.completenessScore;
  }
  return right.id.localeCompare(left.id);
}
function dedupeByPlaceId(venues) {
  const bestByKey = /* @__PURE__ */ new Map();
  for (const venue of venues) {
    const key = venue.source.providerRecordId ?? `${normalizeCity(venue.city)}|${venue.name.trim().toLowerCase()}|${venue.category}`;
    const existing = bestByKey.get(key);
    if (!existing || compareVenueQuality(venue, existing) > 0) {
      bestByKey.set(key, venue);
    }
  }
  const deduped = [...bestByKey.values()].sort((left, right) => left.id.localeCompare(right.id));
  return {
    venues: deduped,
    dropped: Math.max(0, venues.length - deduped.length)
  };
}
function normalizeRawPlaces(rawPlaces, intent) {
  const timeWindowSignal = getTimeWindowSignal(intent);
  const venues = [];
  let droppedCount = 0;
  const droppedReasons = {};
  for (const rawPlace of rawPlaces) {
    try {
      venues.push(
        normalizeVenue(rawPlace, {
          timeWindowSignal
        })
      );
    } catch (error) {
      droppedCount += 1;
      const reason = error instanceof Error && error.message ? `normalize_error:${error.message.split(":")[0]}` : "normalize_error:unknown";
      incrementBucket(droppedReasons, reason);
    }
  }
  return {
    venues,
    droppedCount,
    droppedReasons
  };
}
function countSuppressionReasons(venues) {
  const reasons = {};
  for (const venue of venues) {
    if (venue.source.qualityGateStatus !== "suppressed") {
      continue;
    }
    if (venue.source.suppressionReasons.length === 0) {
      incrementBucket(reasons, "suppressed_without_reason");
      continue;
    }
    for (const reason of venue.source.suppressionReasons) {
      incrementBucket(reasons, reason);
    }
  }
  return reasons;
}
async function fetchLivePlaces(intent, starterPack) {
  const config = getGooglePlacesConfig();
  const queryLocationLabel = formatLocationLabel(intent);
  const baseQueryPlan = buildLiveQueryPlan(intent, starterPack);
  const queryCenters = deriveQueryCenters(intent.city, config.maxCenters, config.centerOffsetM);
  const queryPlan = baseQueryPlan.flatMap(
    (entry) => queryCenters.map((center) => ({
      ...entry,
      label: `${entry.label}@${center.id}`,
      center,
      radiusM: config.queryRadiusM
    }))
  );
  const queryTemplatesUsed = [...new Set(queryPlan.map((entry) => entry.template))];
  const queryLabelsUsed = queryPlan.map((entry) => entry.label);
  const roleIntentQueryNotes = [...new Set(baseQueryPlan.flatMap((entry) => entry.notes))];
  const requestedKindsForPlan = [...new Set(baseQueryPlan.map((entry) => entry.kind))];
  if (!config.apiKey) {
    return {
      venues: [],
      diagnostics: {
        attempted: false,
        provider: "google-places",
        queryLocationLabel,
        queryCentersCount: queryCenters.length,
        queryCentersUsed: queryCenters,
        queryRadiusM: config.queryRadiusM,
        requestedKinds: requestedKindsForPlan,
        queryCount: 0,
        liveQueryTemplatesUsed: queryTemplatesUsed,
        liveQueryLabelsUsed: queryLabelsUsed,
        liveCandidatesByQuery: [],
        liveRoleIntentQueryNotes: roleIntentQueryNotes,
        fetchedCount: 0,
        rawFetchedCount: 0,
        mappedCount: 0,
        mappedDroppedCount: 0,
        mappedDropReasons: emptyMapDropReasons(),
        normalizedCount: 0,
        dedupedByPlaceIdCount: 0,
        normalizationDroppedCount: 0,
        normalizationDropReasons: {},
        acceptedCount: 0,
        acceptanceDroppedCount: 0,
        acceptanceDropReasons: {},
        approvedCount: 0,
        demotedCount: 0,
        suppressedCount: 0,
        partialFailure: false,
        success: false,
        failureReason: "Live adapter disabled because the Google Places API key is missing.",
        errors: []
      }
    };
  }
  const settled = await runQueryPlanInBatches(queryPlan);
  const errors = [];
  let fetchedCount = 0;
  const rawPlaces = [];
  const fetchedCountByQuery = /* @__PURE__ */ new Map();
  const mappedDropReasons = emptyMapDropReasons();
  let mappedDroppedCount = 0;
  for (const result of settled) {
    if (result.status === "rejected") {
      errors.push(result.reason instanceof Error ? result.reason.message : "Unknown live source failure");
      continue;
    }
    const { query, places } = result.value;
    fetchedCount += places.length;
    fetchedCountByQuery.set(query.label, places.length);
    places.forEach((place, index) => {
      const mapped = mapLivePlaceToRawPlaceWithDiagnostics(place, {
        city: intent.city,
        neighborhood: intent.neighborhood,
        requestedKind: query.kind,
        queryLabel: query.label,
        queryTerms: query.queryTerms,
        rank: index
      });
      if (mapped.rawPlace) {
        rawPlaces.push(mapped.rawPlace);
      } else if (mapped.dropReason) {
        mappedDroppedCount += 1;
        mappedDropReasons[mapped.dropReason] = (mappedDropReasons[mapped.dropReason] ?? 0) + 1;
      }
    });
  }
  const normalized = normalizeRawPlaces(rawPlaces, intent);
  const deduped = dedupeByPlaceId(normalized.venues);
  const venues = deduped.venues;
  const successfulQueries = settled.filter((entry) => entry.status === "fulfilled").length;
  const liveCandidatesByQuery = queryPlan.map((query) => {
    const mapped = rawPlaces.filter((rawPlace) => rawPlace.sourceQueryLabel === query.label);
    const normalizedForQuery = normalized.venues.filter(
      (venue) => venue.source.sourceQueryLabel === query.label
    );
    return {
      label: query.label,
      template: query.template,
      roleHint: query.roleHint,
      fetchedCount: fetchedCountByQuery.get(query.label) ?? 0,
      mappedCount: mapped.length,
      normalizedCount: normalizedForQuery.length,
      approvedCount: countByGateStatus(normalizedForQuery, "approved"),
      demotedCount: countByGateStatus(normalizedForQuery, "demoted"),
      suppressedCount: countByGateStatus(normalizedForQuery, "suppressed")
    };
  });
  return {
    venues,
    diagnostics: {
      attempted: true,
      provider: "google-places",
      queryLocationLabel,
      queryCentersCount: queryCenters.length,
      queryCentersUsed: queryCenters,
      queryRadiusM: config.queryRadiusM,
      requestedKinds: requestedKindsForPlan,
      queryCount: queryPlan.length,
      liveQueryTemplatesUsed: queryTemplatesUsed,
      liveQueryLabelsUsed: queryLabelsUsed,
      liveCandidatesByQuery,
      liveRoleIntentQueryNotes: roleIntentQueryNotes,
      fetchedCount,
      rawFetchedCount: fetchedCount,
      mappedCount: rawPlaces.length,
      mappedDroppedCount,
      mappedDropReasons,
      normalizedCount: venues.length,
      dedupedByPlaceIdCount: deduped.dropped,
      normalizationDroppedCount: normalized.droppedCount,
      normalizationDropReasons: normalized.droppedReasons,
      acceptedCount: venues.length - countByGateStatus(venues, "suppressed"),
      acceptanceDroppedCount: countByGateStatus(venues, "suppressed"),
      acceptanceDropReasons: countSuppressionReasons(venues),
      approvedCount: countByGateStatus(venues, "approved"),
      demotedCount: countByGateStatus(venues, "demoted"),
      suppressedCount: countByGateStatus(venues, "suppressed"),
      partialFailure: errors.length > 0 && successfulQueries > 0,
      success: successfulQueries > 0,
      failureReason: successfulQueries === 0 && errors.length > 0 ? errors[0] : void 0,
      errors
    }
  };
}

// src/domain/retrieval/hybridPortableAdapter.ts
var PORTABLE_SEEDS = [
  {
    idSuffix: "central-coffee-hall",
    name: "Central Coffee Hall",
    neighborhoodSuffix: "Central District",
    category: "cafe",
    driveMinutes: 8,
    tags: ["coffee", "warmup", "walkable", "conversation"],
    priceTier: "$$",
    description: "Coffee-forward start point with a calm social tone.",
    narrative: "Portable warmup anchor with low-friction pacing."
  },
  {
    idSuffix: "central-kitchen",
    name: "Central Kitchen",
    neighborhoodSuffix: "Central District",
    category: "restaurant",
    driveMinutes: 9,
    tags: ["dining", "chef-led", "conversation", "neighborhood"],
    priceTier: "$$$",
    description: "Balanced dining anchor with broad route utility.",
    narrative: "Reliable centerpiece dining lane for mixed intents."
  },
  {
    idSuffix: "central-social-club",
    name: "Central Social Club",
    neighborhoodSuffix: "Central District",
    category: "bar",
    driveMinutes: 9,
    tags: ["cocktails", "social", "highlight", "night"],
    priceTier: "$$",
    description: "Social bar anchor with moderate highlight energy.",
    narrative: "Portable momentum bump for lively arcs."
  },
  {
    idSuffix: "central-market-court",
    name: "Central Market Court",
    neighborhoodSuffix: "Central District",
    category: "event",
    driveMinutes: 8,
    tags: ["market", "event", "movement", "walkable"],
    priceTier: "$$",
    description: "Market-style support lane with flexible timing.",
    narrative: "Compact event node for layered sequences."
  },
  {
    idSuffix: "central-arcade-hub",
    name: "Central Arcade Hub",
    neighborhoodSuffix: "Central District",
    category: "activity",
    driveMinutes: 9,
    tags: ["activity", "playful", "group-friendly", "discovery"],
    priceTier: "$$",
    description: "Interactive activity support stop for social groups.",
    narrative: "High-energy optional lane for highlight-adjacent movement."
  },
  {
    idSuffix: "arts-craft-cafe",
    name: "Craft District Cafe",
    neighborhoodSuffix: "Arts District",
    category: "cafe",
    driveMinutes: 11,
    tags: ["coffee", "curated", "low-noise", "linger"],
    priceTier: "$$",
    description: "Arts-side cafe with calmer warmup utility.",
    narrative: "Discovery-friendly opening in the cultural lane."
  },
  {
    idSuffix: "arts-gallery-walk",
    name: "Gallery Walk",
    neighborhoodSuffix: "Arts District",
    category: "activity",
    driveMinutes: 11,
    tags: ["gallery", "discovery", "movement", "cultural-flow"],
    priceTier: "$",
    description: "Walkable gallery corridor with strong cultural signal.",
    narrative: "Cultural discovery connector with low-friction movement."
  },
  {
    idSuffix: "arts-museum-house",
    name: "City Arts House",
    neighborhoodSuffix: "Arts District",
    category: "museum",
    driveMinutes: 12,
    tags: ["museum", "cultural-anchor", "historic", "curated"],
    priceTier: "$$",
    description: "Cultural anchor with slower pacing and discovery depth.",
    narrative: "Portable culture authority for curator/family intents."
  },
  {
    idSuffix: "arts-wine-room",
    name: "Arts Wine Room",
    neighborhoodSuffix: "Arts District",
    category: "bar",
    driveMinutes: 11,
    tags: ["wine", "intimate", "conversation", "slow"],
    priceTier: "$$$",
    description: "Low-noise wine bar with winddown utility.",
    narrative: "Softer highlight option for romantic/cultured arcs."
  },
  {
    idSuffix: "arts-bistro",
    name: "Arts Bistro",
    neighborhoodSuffix: "Arts District",
    category: "restaurant",
    driveMinutes: 12,
    tags: ["dining", "local", "cozy", "curated"],
    priceTier: "$$",
    description: "Neighborhood bistro with approachable cultural tone.",
    narrative: "Supportive dining anchor in arts-forward pockets."
  },
  {
    idSuffix: "riverfront-trail-cafe",
    name: "Riverfront Trail Cafe",
    neighborhoodSuffix: "Riverfront",
    category: "cafe",
    driveMinutes: 13,
    tags: ["coffee", "open-air", "walkable", "reset"],
    priceTier: "$$",
    description: "Open-air cafe for start or reset transitions.",
    narrative: "Outdoors-leaning starter lane near stroll routes."
  },
  {
    idSuffix: "riverfront-park-loop",
    name: "Riverfront Park Loop",
    neighborhoodSuffix: "Riverfront",
    category: "park",
    driveMinutes: 13,
    tags: ["park", "stroll", "reset", "open-air"],
    priceTier: "$",
    description: "Scenic reset route with strong cooldown usefulness.",
    narrative: "Winddown lane that improves sequence quality."
  },
  {
    idSuffix: "riverfront-food-hall",
    name: "Riverfront Food Hall",
    neighborhoodSuffix: "Riverfront",
    category: "event",
    driveMinutes: 14,
    tags: ["food-hall", "social", "event", "variety"],
    priceTier: "$$",
    description: "Flexible social node with broad dining variety.",
    narrative: "Event-like support lane for friends/family groups."
  },
  {
    idSuffix: "riverfront-dining-room",
    name: "Riverfront Dining Room",
    neighborhoodSuffix: "Riverfront",
    category: "restaurant",
    driveMinutes: 14,
    tags: ["dining", "conversation", "neighborhood", "highlight"],
    priceTier: "$$$",
    description: "Steady dining anchor with medium-intensity pace.",
    narrative: "Adaptable center point for mixed route shapes."
  },
  {
    idSuffix: "riverfront-gelato-house",
    name: "Riverfront Gelato House",
    neighborhoodSuffix: "Riverfront",
    category: "dessert",
    driveMinutes: 13,
    tags: ["dessert", "shareable", "cooldown", "walkable"],
    priceTier: "$$",
    description: "Dessert lane with strong winddown compatibility.",
    narrative: "Soft landing option that improves end-role fit."
  },
  {
    idSuffix: "neighborhood-bakery-cafe",
    name: "Neighborhood Bakery Cafe",
    neighborhoodSuffix: "Neighborhood Core",
    category: "cafe",
    driveMinutes: 10,
    tags: ["bakery", "coffee", "cozy", "low-noise"],
    priceTier: "$$",
    description: "Cozy bakery cafe with low-friction start utility.",
    narrative: "Soft neighborhood entry for cozy/family arcs."
  },
  {
    idSuffix: "neighborhood-dinner-house",
    name: "Neighborhood Dinner House",
    neighborhoodSuffix: "Neighborhood Core",
    category: "restaurant",
    driveMinutes: 10,
    tags: ["dining", "conversation", "family-friendly", "local"],
    priceTier: "$$",
    description: "Approachable dining anchor with broad usefulness.",
    narrative: "Comfortable core dining lane with stable pacing."
  },
  {
    idSuffix: "neighborhood-green-park",
    name: "Neighborhood Green Park",
    neighborhoodSuffix: "Neighborhood Core",
    category: "park",
    driveMinutes: 10,
    tags: ["park", "reset", "open-air", "family-friendly"],
    priceTier: "$",
    description: "Calmer open-air support venue for transitions.",
    narrative: "Reset anchor for softer sequence movement."
  },
  {
    idSuffix: "neighborhood-dessert-kitchen",
    name: "Neighborhood Dessert Kitchen",
    neighborhoodSuffix: "Neighborhood Core",
    category: "dessert",
    driveMinutes: 10,
    tags: ["dessert", "cozy", "shareable", "cooldown"],
    priceTier: "$$",
    description: "Dessert support lane for romantic/family winddowns.",
    narrative: "Reliable gentle finish lane in residential pockets."
  },
  {
    idSuffix: "neighborhood-listening-bar",
    name: "Neighborhood Listening Bar",
    neighborhoodSuffix: "Neighborhood Core",
    category: "bar",
    driveMinutes: 11,
    tags: ["listening", "intimate", "conversation", "night"],
    priceTier: "$$",
    description: "Lower-noise social option for smaller groups.",
    narrative: "Conversation-forward highlight for softer nights."
  }
];
function normalizeCity2(value) {
  const normalized = value.trim().toLowerCase().replace(/\./g, "");
  const [head] = normalized.split(",");
  return (head ?? normalized).replace(/\s+/g, " ").trim();
}
var KNOWN_CITY_CENTERS2 = {
  "san jose": { lat: 37.3382, lng: -121.8863 },
  denver: { lat: 39.7392, lng: -104.9903 },
  austin: { lat: 30.2672, lng: -97.7431 }
};
function toTitleCase(value) {
  return value.split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function hashString3(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function hashToUnit2(value) {
  return hashString3(value) / 4294967295;
}
function getCityCenter2(city) {
  const key = normalizeCity2(city);
  const known = KNOWN_CITY_CENTERS2[key];
  if (known) {
    return known;
  }
  return {
    lat: Number((30.5 + hashToUnit2(`${key}:lat`) * 11.5).toFixed(4)),
    lng: Number((-121.5 + hashToUnit2(`${key}:lng`) * 23.5).toFixed(4))
  };
}
function gateStatusRank2(status) {
  if (status === "approved") {
    return 3;
  }
  if (status === "demoted") {
    return 2;
  }
  return 1;
}
function compareVenueQuality2(left, right) {
  const gateDelta = gateStatusRank2(left.source.qualityGateStatus) - gateStatusRank2(right.source.qualityGateStatus);
  if (gateDelta !== 0) {
    return gateDelta;
  }
  if (left.source.qualityScore !== right.source.qualityScore) {
    return left.source.qualityScore - right.source.qualityScore;
  }
  if (left.source.sourceConfidence !== right.source.sourceConfidence) {
    return left.source.sourceConfidence - right.source.sourceConfidence;
  }
  if (left.source.completenessScore !== right.source.completenessScore) {
    return left.source.completenessScore - right.source.completenessScore;
  }
  return right.id.localeCompare(left.id);
}
function sortByQuality(venues) {
  return [...venues].sort((left, right) => {
    const qualityDelta = compareVenueQuality2(right, left);
    if (qualityDelta !== 0) {
      return qualityDelta;
    }
    return left.id.localeCompare(right.id);
  });
}
function dedupeVenues(venues) {
  const bestByKey = /* @__PURE__ */ new Map();
  for (const venue of venues) {
    const key = venue.source.providerRecordId ?? `${normalizeCity2(venue.city)}|${slugify(venue.name)}|${slugify(venue.neighborhood)}|${venue.category}`;
    const existing = bestByKey.get(key);
    if (!existing || compareVenueQuality2(venue, existing) > 0) {
      bestByKey.set(key, venue);
    }
  }
  return sortByQuality([...bestByKey.values()]);
}
function mergeReasonCounts(current, incoming) {
  const merged = { ...current };
  for (const [reason, count] of Object.entries(incoming)) {
    merged[reason] = (merged[reason] ?? 0) + count;
  }
  return merged;
}
function clamp018(value) {
  return Math.max(0, Math.min(1, value));
}
function getGeoBucketKey(venue) {
  const latitude = venue.source.latitude;
  const longitude = venue.source.longitude;
  if (typeof latitude === "number" && typeof longitude === "number") {
    const latBucket = Math.round(latitude / 0.018);
    const lngBucket = Math.round(longitude / 0.018);
    return `grid:${latBucket}:${lngBucket}`;
  }
  const neighborhoodKey = slugify(venue.neighborhood);
  if (neighborhoodKey) {
    return `nbh:${neighborhoodKey}`;
  }
  return "unknown";
}
function summarizeGeoSpread(venues) {
  const bucketMap = /* @__PURE__ */ new Map();
  for (const venue of venues) {
    const key = getGeoBucketKey(venue);
    const entries = bucketMap.get(key) ?? [];
    entries.push(venue);
    bucketMap.set(key, entries);
  }
  const bucketCount = bucketMap.size;
  const total = venues.length;
  const dominantEntry = [...bucketMap.entries()].sort((left, right) => {
    if (right[1].length !== left[1].length) {
      return right[1].length - left[1].length;
    }
    return left[0].localeCompare(right[0]);
  })[0];
  const dominantCount = dominantEntry?.[1].length ?? 0;
  const dominantAreaShare = total > 0 ? Number((dominantCount / total).toFixed(3)) : 0;
  const bucketComponent = clamp018((bucketCount - 1) / 4);
  const balanceComponent = clamp018(1 - dominantAreaShare);
  const geoSpreadScore = Number((bucketComponent * 0.6 + balanceComponent * 0.4).toFixed(3));
  return {
    geoBucketCount: bucketCount,
    dominantAreaShare,
    geoSpreadScore,
    dominantBucketKey: dominantEntry?.[0],
    bucketMap
  };
}
function applyGeoDiversityShaping(venues) {
  const summary = summarizeGeoSpread(venues);
  if (venues.length < 10 || summary.geoBucketCount < 2 || summary.dominantAreaShare <= 0.5) {
    return {
      venues,
      geoBucketCount: summary.geoBucketCount,
      dominantAreaShare: summary.dominantAreaShare,
      geoSpreadScore: summary.geoSpreadScore,
      downsampledCount: 0,
      notes: []
    };
  }
  const dominantBucketKey = summary.dominantBucketKey;
  if (!dominantBucketKey) {
    return {
      venues,
      geoBucketCount: summary.geoBucketCount,
      dominantAreaShare: summary.dominantAreaShare,
      geoSpreadScore: summary.geoSpreadScore,
      downsampledCount: 0,
      notes: []
    };
  }
  const dominantBucket = sortByQuality(summary.bucketMap.get(dominantBucketKey) ?? []);
  const nonDominant = sortByQuality(
    [...summary.bucketMap.entries()].filter(([key]) => key !== dominantBucketKey).flatMap(([, bucketVenues]) => bucketVenues)
  );
  const total = venues.length;
  const dominantCap = Math.max(6, Math.ceil(total * 0.55));
  if (dominantBucket.length <= dominantCap) {
    return {
      venues,
      geoBucketCount: summary.geoBucketCount,
      dominantAreaShare: summary.dominantAreaShare,
      geoSpreadScore: summary.geoSpreadScore,
      downsampledCount: 0,
      notes: []
    };
  }
  const trimmedDominant = dominantBucket.slice(0, dominantCap);
  const shaped = sortByQuality([...trimmedDominant, ...nonDominant]);
  const shapedSummary = summarizeGeoSpread(shaped);
  return {
    venues: shaped,
    geoBucketCount: shapedSummary.geoBucketCount,
    dominantAreaShare: shapedSummary.dominantAreaShare,
    geoSpreadScore: shapedSummary.geoSpreadScore,
    downsampledCount: dominantBucket.length - trimmedDominant.length,
    notes: [
      `Geo diversity shaping trimmed ${dominantBucket.length - trimmedDominant.length} dominant-area venues to improve bucket balance.`
    ]
  };
}
function selectGeoBalancedVenues(venues, maxCount) {
  if (venues.length <= maxCount) {
    return venues;
  }
  const bucketMap = /* @__PURE__ */ new Map();
  for (const venue of sortByQuality(venues)) {
    const key = getGeoBucketKey(venue);
    const entries = bucketMap.get(key) ?? [];
    entries.push(venue);
    bucketMap.set(key, entries);
  }
  const bucketOrder = [...bucketMap.entries()].sort((left, right) => {
    const leftHead = left[1][0];
    const rightHead = right[1][0];
    if (leftHead && rightHead) {
      const qualityDelta = compareVenueQuality2(rightHead, leftHead);
      if (qualityDelta !== 0) {
        return qualityDelta;
      }
    }
    return left[0].localeCompare(right[0]);
  }).map(([key]) => key);
  const selected = [];
  while (selected.length < maxCount) {
    let advanced = false;
    for (const bucketKey of bucketOrder) {
      const entries = bucketMap.get(bucketKey);
      if (!entries || entries.length === 0) {
        continue;
      }
      const nextVenue = entries.shift();
      if (!nextVenue) {
        continue;
      }
      selected.push(nextVenue);
      advanced = true;
      if (selected.length >= maxCount) {
        break;
      }
    }
    if (!advanced) {
      break;
    }
  }
  return sortByQuality(selected);
}
function projectNeighborhoodByGeoArea(venues, city) {
  const cityCenter = getCityCenter2(city);
  return venues.map((venue) => {
    const latitude = venue.source.latitude;
    const longitude = venue.source.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return venue;
    }
    const latDelta = latitude - cityCenter.lat;
    const lngDelta = longitude - cityCenter.lng;
    const absLat = Math.abs(latDelta);
    const absLng = Math.abs(lngDelta);
    let areaLabel = "Central";
    if (absLat > 0.012 || absLng > 0.012) {
      areaLabel = absLat >= absLng ? latDelta >= 0 ? "North" : "South" : lngDelta >= 0 ? "East" : "West";
    }
    return {
      ...venue,
      neighborhood: `${toTitleCase(normalizeCity2(city) || city)} ${areaLabel} District`
    };
  });
}
function buildIntent(city, primaryAnchor, crew) {
  return {
    crew,
    primaryAnchor,
    city,
    distanceMode: "short-drive",
    prefersHiddenGems: primaryAnchor === "cultured" || primaryAnchor === "adventurous-urban",
    mode: "build",
    planningMode: "engine-led"
  };
}
function buildPortableBootstrapVenues(city) {
  const cityLabel = toTitleCase(normalizeCity2(city) || city);
  const citySlug = slugify(cityLabel || "portable-city");
  return PORTABLE_SEEDS.map(
    (seed) => normalizeVenue({
      rawType: "place",
      id: `hybrid_${citySlug}_${seed.idSuffix}`,
      name: `${cityLabel} ${seed.name}`,
      city: cityLabel,
      neighborhood: `${cityLabel} ${seed.neighborhoodSuffix}`,
      driveMinutes: seed.driveMinutes,
      priceTier: seed.priceTier,
      tags: [...seed.tags, "portable-bootstrap", "hybrid"],
      shortDescription: seed.description,
      narrativeFlavor: seed.narrative,
      categoryHint: seed.category,
      subcategoryHint: seed.tags[0] ?? seed.category,
      placeTypes: [seed.category, ...seed.tags.slice(0, 2)],
      sourceTypes: [seed.category, "portable-bootstrap"],
      normalizedFromRawType: "raw-place",
      sourceOrigin: "live",
      sourceQueryLabel: "portable-bootstrap",
      sourceConfidence: 0.62,
      isChain: false,
      isHiddenGem: true,
      uniquenessScore: 0.72,
      distinctivenessScore: 0.74,
      underexposureScore: 0.73,
      shareabilityScore: 0.7,
      vibeTags: ["culture", "creative", "relaxed"]
    })
  );
}
async function fetchHybridPortableVenues(city) {
  const normalizedCity = toTitleCase(normalizeCity2(city) || city);
  if (!normalizedCity) {
    return {
      venues: [],
      diagnostics: {
        mode: "none",
        city,
        liveAttempted: false,
        liveSucceeded: false,
        liveRawFetched: 0,
        liveMapped: 0,
        liveMappedDropped: 0,
        liveMapDropReasons: {},
        liveNormalized: 0,
        liveNormalizationDropped: 0,
        liveNormalizationDropReasons: {},
        liveAcceptedPreGeo: 0,
        liveAccepted: 0,
        liveSuppressed: 0,
        liveSuppressionReasons: {},
        geoBucketCount: 0,
        dominantAreaShare: 0,
        geoSpreadScore: 0,
        geoDiversityDownsampledCount: 0,
        bootstrapCount: 0,
        selectedCount: 0,
        notes: ["No city provided for hybrid retrieval."]
      }
    };
  }
  const liveIntents = [
    buildIntent(normalizedCity, "cozy", "romantic"),
    buildIntent(normalizedCity, "lively", "socialite"),
    buildIntent(normalizedCity, "cultured", "curator")
  ];
  const liveResults = await Promise.all(liveIntents.map((intent) => fetchLivePlaces(intent)));
  const liveAcceptedBeforeDedupe = liveResults.flatMap((entry) => entry.venues).filter((venue) => venue.source.qualityGateStatus !== "suppressed");
  const liveSuppressedBeforeDedupe = liveResults.flatMap((entry) => entry.venues).filter((venue) => venue.source.qualityGateStatus === "suppressed");
  const liveVenuesDeduped = dedupeVenues(
    liveAcceptedBeforeDedupe
  );
  const geoShapedLiveVenues = applyGeoDiversityShaping(liveVenuesDeduped);
  const liveVenues = geoShapedLiveVenues.venues;
  const liveRawFetched = liveResults.reduce(
    (sum, entry) => sum + entry.diagnostics.rawFetchedCount,
    0
  );
  const liveMapped = liveResults.reduce((sum, entry) => sum + entry.diagnostics.mappedCount, 0);
  const liveMappedDropped = liveResults.reduce(
    (sum, entry) => sum + entry.diagnostics.mappedDroppedCount,
    0
  );
  const liveMapDropReasons = liveResults.reduce(
    (merged2, entry) => mergeReasonCounts(merged2, entry.diagnostics.mappedDropReasons),
    {}
  );
  const liveNormalized = liveResults.reduce(
    (sum, entry) => sum + entry.diagnostics.normalizedCount,
    0
  );
  const liveNormalizationDropped = liveResults.reduce(
    (sum, entry) => sum + entry.diagnostics.normalizationDroppedCount,
    0
  );
  const liveNormalizationDropReasons = liveResults.reduce(
    (merged2, entry) => mergeReasonCounts(merged2, entry.diagnostics.normalizationDropReasons),
    {}
  );
  const liveSuppressionReasons = liveResults.reduce(
    (merged2, entry) => mergeReasonCounts(merged2, entry.diagnostics.acceptanceDropReasons),
    {}
  );
  const liveAttempted = liveResults.some((entry) => entry.diagnostics.attempted);
  const liveSucceeded = liveResults.some((entry) => entry.diagnostics.success);
  const dedupeDropped = liveAcceptedBeforeDedupe.length - liveVenuesDeduped.length;
  if (liveVenues.length >= 12) {
    const selectedLiveVenues = projectNeighborhoodByGeoArea(
      selectGeoBalancedVenues(liveVenues, 32),
      normalizedCity
    );
    return {
      venues: selectedLiveVenues,
      diagnostics: {
        mode: "hybrid_live",
        city: normalizedCity,
        liveAttempted,
        liveSucceeded,
        liveRawFetched,
        liveMapped,
        liveMappedDropped,
        liveMapDropReasons,
        liveNormalized,
        liveNormalizationDropped,
        liveNormalizationDropReasons,
        liveAcceptedPreGeo: liveVenuesDeduped.length,
        liveAccepted: liveVenues.length,
        liveSuppressed: liveSuppressedBeforeDedupe.length,
        liveSuppressionReasons,
        geoBucketCount: geoShapedLiveVenues.geoBucketCount,
        dominantAreaShare: geoShapedLiveVenues.dominantAreaShare,
        geoSpreadScore: geoShapedLiveVenues.geoSpreadScore,
        geoDiversityDownsampledCount: geoShapedLiveVenues.downsampledCount,
        bootstrapCount: 0,
        selectedCount: selectedLiveVenues.length,
        notes: [
          "Live hybrid retrieval provided enough entities without bootstrap support.",
          ...dedupeDropped > 0 ? [`${dedupeDropped} duplicate live entities collapsed during merge.`] : [],
          ...geoShapedLiveVenues.notes,
          ...selectedLiveVenues.length < liveVenues.length ? [`Geo-balanced selection chose ${selectedLiveVenues.length} venues from ${liveVenues.length} live candidates.`] : []
        ]
      }
    };
  }
  const bootstrapVenues = buildPortableBootstrapVenues(normalizedCity);
  const merged = dedupeVenues([...liveVenues, ...bootstrapVenues]);
  const selectedMergedVenues = projectNeighborhoodByGeoArea(
    selectGeoBalancedVenues(merged, 36),
    normalizedCity
  );
  const mode = liveVenues.length > 0 ? "hybrid_live_plus_bootstrap" : "hybrid_bootstrap";
  return {
    venues: selectedMergedVenues,
    diagnostics: {
      mode,
      city: normalizedCity,
      liveAttempted,
      liveSucceeded,
      liveRawFetched,
      liveMapped,
      liveMappedDropped,
      liveMapDropReasons,
      liveNormalized,
      liveNormalizationDropped,
      liveNormalizationDropReasons,
      liveAcceptedPreGeo: liveVenuesDeduped.length,
      liveAccepted: liveVenues.length,
      liveSuppressed: liveSuppressedBeforeDedupe.length,
      liveSuppressionReasons,
      geoBucketCount: geoShapedLiveVenues.geoBucketCount,
      dominantAreaShare: geoShapedLiveVenues.dominantAreaShare,
      geoSpreadScore: geoShapedLiveVenues.geoSpreadScore,
      geoDiversityDownsampledCount: geoShapedLiveVenues.downsampledCount,
      bootstrapCount: bootstrapVenues.length,
      selectedCount: selectedMergedVenues.length,
      notes: mode === "hybrid_bootstrap" ? [
        "Live retrieval unavailable or too thin; portable bootstrap fallback supplied the field.",
        ...liveAttempted ? [
          `Live attrition snapshot: fetched ${liveRawFetched}, mapped ${liveMapped}, normalized ${liveNormalized}, accepted ${liveVenues.length}.`
        ] : []
      ] : [
        "Live retrieval was thin; portable bootstrap supplemented coverage for district formation.",
        `Live attrition snapshot: fetched ${liveRawFetched}, mapped ${liveMapped}, normalized ${liveNormalized}, accepted ${liveVenues.length}.`,
        ...dedupeDropped > 0 ? [`${dedupeDropped} duplicate live entities collapsed during merge.`] : [],
        ...geoShapedLiveVenues.notes,
        ...selectedMergedVenues.length < merged.length ? [
          `Geo-balanced selection chose ${selectedMergedVenues.length} venues from ${merged.length} total candidates.`
        ] : []
      ]
    }
  };
}

// src/engines/district/location/pseudoCityCenter.ts
function normalizeCityKey(value) {
  const normalized = (value ?? "").trim().toLowerCase().replace(/\./g, "");
  const [head] = normalized.split(",");
  return (head ?? normalized).replace(/\s+/g, " ").trim();
}
function hashString4(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function hashToUnit3(value) {
  return hashString4(value) / 4294967295;
}
function getPseudoCityCenter(city) {
  const cityKey = normalizeCityKey(city) || "unknown";
  const lat = 30.5 + hashToUnit3(`${cityKey}:lat`) * 11.5;
  const lng = -121.5 + hashToUnit3(`${cityKey}:lng`) * 23.5;
  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4))
  };
}

// src/engines/district/entities/normalizePlaceEntity.ts
var DEFAULT_ANCHOR = {
  key: "default-downtown-core",
  lat: 37.3386,
  lng: -121.8856,
  jitterRadiusM: 72
};
var CITY_DEFAULT_ANCHORS = {
  "san jose": {
    key: "san-jose-default-core",
    lat: 37.3386,
    lng: -121.8856,
    jitterRadiusM: 72
  },
  denver: {
    key: "denver-default-core",
    lat: 39.7392,
    lng: -104.9903,
    jitterRadiusM: 78
  }
};
var CITY_NEIGHBORHOOD_ANCHORS = {
  "san jose": {
    downtown: {
      key: "downtown-core",
      lat: 37.3384,
      lng: -121.8858,
      jitterRadiusM: 68
    },
    "sofa district": {
      key: "sofa-south",
      lat: 37.3305,
      lng: -121.8879,
      jitterRadiusM: 64
    },
    "san pedro": {
      key: "san-pedro-northwest",
      lat: 37.3395,
      lng: -121.8942,
      jitterRadiusM: 62
    },
    "santana row": {
      key: "santana-row",
      lat: 37.3211,
      lng: -121.9495,
      jitterRadiusM: 78
    },
    "north san jose": {
      key: "north-san-jose",
      lat: 37.391,
      lng: -121.9373,
      jitterRadiusM: 88
    },
    "rose garden": {
      key: "rose-garden",
      lat: 37.3349,
      lng: -121.922,
      jitterRadiusM: 74
    },
    "kelley park": {
      key: "kelley-park",
      lat: 37.3267,
      lng: -121.8683,
      jitterRadiusM: 82
    },
    "alum rock": {
      key: "alum-rock",
      lat: 37.381,
      lng: -121.8207,
      jitterRadiusM: 86
    },
    evergreen: {
      key: "evergreen",
      lat: 37.2869,
      lng: -121.7879,
      jitterRadiusM: 86
    },
    "willow glen": {
      key: "willow-glen",
      lat: 37.3075,
      lng: -121.9018,
      jitterRadiusM: 78
    },
    "the alameda": {
      key: "the-alameda",
      lat: 37.3384,
      lng: -121.9139,
      jitterRadiusM: 74
    },
    japantown: {
      key: "japantown",
      lat: 37.3491,
      lng: -121.8941,
      jitterRadiusM: 72
    }
  },
  denver: {
    "downtown / lodo": {
      key: "denver-downtown-lodo",
      lat: 39.7527,
      lng: -104.9993,
      jitterRadiusM: 78
    },
    rino: {
      key: "denver-rino",
      lat: 39.7688,
      lng: -104.9799,
      jitterRadiusM: 76
    },
    "cherry creek": {
      key: "denver-cherry-creek",
      lat: 39.7197,
      lng: -104.9522,
      jitterRadiusM: 72
    },
    "highlands / lohi": {
      key: "denver-highlands-lohi",
      lat: 39.7583,
      lng: -105.013,
      jitterRadiusM: 74
    }
  }
};
function normalizeNeighborhoodKey(value) {
  return (value ?? "").trim().toLowerCase();
}
function hashString5(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function hashToUnit4(value) {
  return hashString5(value) / 4294967295;
}
function metersToLatDegrees2(meters) {
  return meters / 111320;
}
function metersToLngDegrees2(meters, atLat) {
  const radians = atLat * Math.PI / 180;
  const metersPerDegree = 111320 * Math.cos(radians);
  const safeMetersPerDegree = Math.max(2e4, metersPerDegree);
  return meters / safeMetersPerDegree;
}
function toEntityType(category) {
  if (category === "event") {
    return "event";
  }
  if (category === "live_music") {
    return "program";
  }
  if (category === "museum" || category === "activity" || category === "park") {
    return "hub";
  }
  return "venue";
}
function toFixedScore(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}
function buildDynamicCityAnchor(cityKey) {
  const pseudoCenter = getPseudoCityCenter(cityKey);
  return {
    key: `${cityKey || "unknown"}-default-core`,
    lat: pseudoCenter.lat,
    lng: pseudoCenter.lng,
    jitterRadiusM: 84
  };
}
function buildDynamicNeighborhoodAnchor(cityKey, neighborhoodKey) {
  const cityAnchor = CITY_DEFAULT_ANCHORS[cityKey] ?? buildDynamicCityAnchor(cityKey);
  const angle = hashToUnit4(`${cityKey}:${neighborhoodKey}:angle`) * Math.PI * 2;
  const radiusM = 520 + hashToUnit4(`${cityKey}:${neighborhoodKey}:radius`) * 720;
  const northM = Math.sin(angle) * radiusM;
  const eastM = Math.cos(angle) * radiusM;
  return {
    key: `${cityKey || "unknown"}-${neighborhoodKey || "generic"}-dynamic`,
    lat: cityAnchor.lat + metersToLatDegrees2(northM),
    lng: cityAnchor.lng + metersToLngDegrees2(eastM, cityAnchor.lat),
    jitterRadiusM: 86
  };
}
function buildLocation(venue) {
  const cityKey = normalizeCityKey(venue.city);
  const neighborhoodKey = normalizeNeighborhoodKey(venue.neighborhood);
  const cityNeighborhoodAnchors = CITY_NEIGHBORHOOD_ANCHORS[cityKey] ?? {};
  const dynamicNeighborhoodAnchor = neighborhoodKey ? buildDynamicNeighborhoodAnchor(cityKey, neighborhoodKey) : void 0;
  const base = cityNeighborhoodAnchors[neighborhoodKey] ?? dynamicNeighborhoodAnchor ?? CITY_DEFAULT_ANCHORS[cityKey] ?? buildDynamicCityAnchor(cityKey) ?? DEFAULT_ANCHOR;
  const angleRadians = hashToUnit4(`${venue.id}:angle`) * Math.PI * 2;
  const radialScale = Math.sqrt(hashToUnit4(`${venue.id}:radius`));
  const jitterMeters = radialScale * base.jitterRadiusM;
  const jitterNorthM = Math.sin(angleRadians) * jitterMeters;
  const jitterEastM = Math.cos(angleRadians) * jitterMeters;
  const latJitter = metersToLatDegrees2(jitterNorthM);
  const lngJitter = metersToLngDegrees2(jitterEastM, base.lat);
  return {
    lat: base.lat + latJitter,
    lng: base.lng + lngJitter,
    normalizedNeighborhoodKey: neighborhoodKey,
    anchorKey: base.key,
    jitterRadiusM: base.jitterRadiusM
  };
}
function normalizePlaceEntity(venue) {
  const popularity = venue.uniquenessScore * 0.35 + venue.shareabilityScore * 0.25 + venue.localSignals.localFavoriteScore * 0.4;
  const activity = venue.energyLevel / 5;
  const trust = venue.source.qualityScore * 0.45 + venue.source.sourceConfidence * 0.35 + venue.localSignals.repeatVisitorScore * 0.2;
  const location = buildLocation(venue);
  return {
    id: venue.id,
    name: venue.name,
    location: {
      lat: location.lat,
      lng: location.lng
    },
    type: toEntityType(venue.category),
    categories: [venue.category, venue.subcategory, ...venue.source.sourceTypes].filter(
      Boolean
    ),
    tags: [...venue.tags, ...venue.vibeTags].filter(Boolean),
    metadata: {
      hours: {
        hoursKnown: venue.source.hoursKnown,
        likelyOpenForCurrentWindow: venue.source.likelyOpenForCurrentWindow,
        pressureLevel: venue.source.hoursPressureLevel
      },
      organizationType: venue.isChain ? "chain" : "local",
      address: `${venue.neighborhood}, ${venue.city}`,
      neighborhood: venue.neighborhood,
      sublocality: venue.neighborhood,
      pseudoGeo: {
        normalizedNeighborhoodKey: location.normalizedNeighborhoodKey,
        anchorKey: location.anchorKey,
        jitterRadiusM: location.jitterRadiusM
      }
    },
    signals: {
      popularity: toFixedScore(popularity),
      activity: toFixedScore(activity),
      trust: toFixedScore(trust),
      openNow: venue.source.openNow
    }
  };
}

// src/engines/district/entities/fetchPlaceEntities.ts
var DEFAULT_MAX_ENTITIES = 120;
var MIN_MAX_ENTITIES = 20;
var MAX_MAX_ENTITIES = 500;
function clamp3(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function normalizeCity3(value) {
  const token = (value ?? "").trim().toLowerCase().split(",")[0] ?? "";
  return token.replace(/\s+/g, " ").trim();
}
function uniqueById(entities) {
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const entity of entities) {
    if (seen.has(entity.id)) {
      continue;
    }
    seen.add(entity.id);
    deduped.push(entity);
  }
  return deduped;
}
async function fetchPlaceEntities(input) {
  const cityHint = normalizeCity3(input.resolvedLocation.meta.city);
  const curatedCityVenues = cityHint.length > 0 ? curatedVenues.filter((venue) => normalizeCity3(venue.city) === cityHint) : [];
  const hasCuratedCoverage = curatedCityVenues.length >= 10;
  let sourceVenues = curatedCityVenues;
  let retrieval = {
    mode: hasCuratedCoverage ? "curated" : "none",
    city: input.resolvedLocation.meta.city ?? cityHint,
    curatedCount: curatedCityVenues.length,
    liveRawFetchedCount: 0,
    liveFetchedCount: 0,
    liveMappedCount: 0,
    liveMappedDroppedCount: 0,
    liveMapDropReasons: {},
    liveNormalizedCount: 0,
    liveNormalizationDroppedCount: 0,
    liveNormalizationDropReasons: {},
    liveAcceptedPreGeoCount: 0,
    liveAcceptedCount: 0,
    liveSuppressedCount: 0,
    liveSuppressionReasons: {},
    geoBucketCount: 0,
    dominantAreaShare: 0,
    geoSpreadScore: 0,
    geoDiversityDownsampledCount: 0,
    bootstrapCount: 0,
    selectedCount: 0,
    notes: hasCuratedCoverage ? ["Curated city inventory used for district entity retrieval."] : ["No curated coverage found for requested city."]
  };
  if (!hasCuratedCoverage && cityHint.length > 0) {
    const hybrid = await fetchHybridPortableVenues(cityHint);
    sourceVenues = hybrid.venues;
    retrieval = {
      mode: hybrid.diagnostics.mode,
      city: hybrid.diagnostics.city,
      curatedCount: curatedCityVenues.length,
      liveRawFetchedCount: hybrid.diagnostics.liveRawFetched,
      liveFetchedCount: hybrid.diagnostics.liveRawFetched,
      liveMappedCount: hybrid.diagnostics.liveMapped,
      liveMappedDroppedCount: hybrid.diagnostics.liveMappedDropped,
      liveMapDropReasons: hybrid.diagnostics.liveMapDropReasons,
      liveNormalizedCount: hybrid.diagnostics.liveNormalized,
      liveNormalizationDroppedCount: hybrid.diagnostics.liveNormalizationDropped,
      liveNormalizationDropReasons: hybrid.diagnostics.liveNormalizationDropReasons,
      liveAcceptedPreGeoCount: hybrid.diagnostics.liveAcceptedPreGeo,
      liveAcceptedCount: hybrid.diagnostics.liveAccepted,
      liveSuppressedCount: hybrid.diagnostics.liveSuppressed,
      liveSuppressionReasons: hybrid.diagnostics.liveSuppressionReasons,
      geoBucketCount: hybrid.diagnostics.geoBucketCount,
      dominantAreaShare: hybrid.diagnostics.dominantAreaShare,
      geoSpreadScore: hybrid.diagnostics.geoSpreadScore,
      geoDiversityDownsampledCount: hybrid.diagnostics.geoDiversityDownsampledCount,
      bootstrapCount: hybrid.diagnostics.bootstrapCount,
      selectedCount: hybrid.diagnostics.selectedCount,
      notes: hybrid.diagnostics.notes
    };
  }
  const seeded = sourceVenues;
  const normalized = uniqueById(seeded.map(normalizePlaceEntity));
  const maxEntities = clamp3(
    input.maxEntities ?? DEFAULT_MAX_ENTITIES,
    MIN_MAX_ENTITIES,
    MAX_MAX_ENTITIES
  );
  const searchRadiusM = input.searchRadiusM ?? input.resolvedLocation.radiusM;
  const withDistance = normalized.map((entity) => ({
    entity,
    distanceM: haversineDistanceM(entity.location, input.resolvedLocation.center)
  })).sort((left, right) => {
    if (left.distanceM !== right.distanceM) {
      return left.distanceM - right.distanceM;
    }
    const leftPopularity = left.entity.signals?.popularity ?? 0;
    const rightPopularity = right.entity.signals?.popularity ?? 0;
    return rightPopularity - leftPopularity;
  });
  const inRadius = withDistance.filter((item) => item.distanceM <= searchRadiusM);
  const selected = inRadius.length >= 3 ? inRadius.slice(0, maxEntities) : withDistance.slice(0, Math.min(maxEntities, withDistance.length));
  return {
    entities: selected.map((item) => item.entity),
    retrieval: {
      ...retrieval,
      selectedCount: selected.length
    }
  };
}

// src/engines/district/identity/identityDecision.ts
function toFixed(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}
function titleCase(value) {
  return value.split(/[\s_-]+/).filter(Boolean).map((segment) => segment[0].toUpperCase() + segment.slice(1)).join(" ");
}
function makeIdentityDecision(pocket, signals) {
  if (signals.dominantNeighborhood && signals.neighborhoodDominance >= 0.45) {
    const confidence = toFixed(0.58 + signals.neighborhoodDominance * 0.32);
    return {
      pocketLabel: `${signals.dominantNeighborhood} Pocket`,
      kind: "known_neighborhood",
      confidence,
      signals: {
        neighborhoodDominance: signals.neighborhoodDominance,
        dominantCategory: signals.dominantCategory,
        dominantCategoryShare: signals.dominantCategoryShare
      },
      rationale: [
        "Neighborhood majority observed across clustered entities.",
        "Label uses inferred local grouping, not formal boundary certainty."
      ]
    };
  }
  if (signals.dominantCategoryShare >= 0.55) {
    return {
      pocketLabel: `${titleCase(signals.dominantCategory)} Cluster`,
      kind: "inferred",
      confidence: toFixed(0.46 + signals.dominantCategoryShare * 0.28),
      signals: {
        dominantCategory: signals.dominantCategory,
        dominantCategoryShare: signals.dominantCategoryShare,
        walkability: signals.walkabilityScore
      },
      rationale: [
        "Functional identity inferred from category concentration.",
        "No stable neighborhood certainty available from current evidence."
      ]
    };
  }
  return {
    pocketLabel: `Local Pocket ${pocket.id.replace("raw-pocket-", "")}`,
    kind: "unknown",
    confidence: toFixed(0.35 + signals.walkabilityScore * 0.18),
    signals: {
      walkability: signals.walkabilityScore,
      entityCount: signals.entityCount
    },
    rationale: [
      "Mixed pocket identity; kept generic to avoid false neighborhood certainty."
    ]
  };
}

// src/engines/district/identity/identitySignals.ts
function toFixed2(value) {
  return Number(value.toFixed(3));
}
function getDominantNeighborhood(pocket) {
  const counts = /* @__PURE__ */ new Map();
  for (const entity of pocket.entities) {
    const neighborhood2 = entity.metadata?.neighborhood;
    if (!neighborhood2) {
      continue;
    }
    counts.set(neighborhood2, (counts.get(neighborhood2) ?? 0) + 1);
  }
  if (counts.size === 0) {
    return { neighborhood: void 0, dominance: 0 };
  }
  const [neighborhood, count] = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0];
  return {
    neighborhood,
    dominance: count / pocket.entities.length
  };
}
function getDominantCategory(pocket) {
  const entries = Object.entries(pocket.categoryCounts);
  if (entries.length === 0) {
    return { category: "mixed", share: 0 };
  }
  const [category, count] = entries.sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0];
  return {
    category,
    share: count / pocket.entities.length
  };
}
function computeIdentitySignals(pocket) {
  const neighborhood = getDominantNeighborhood(pocket);
  const category = getDominantCategory(pocket);
  return {
    dominantNeighborhood: neighborhood.neighborhood,
    neighborhoodDominance: toFixed2(neighborhood.dominance),
    dominantCategory: category.category,
    dominantCategoryShare: toFixed2(category.share),
    entityCount: pocket.entities.length,
    walkabilityScore: pocket.viability.signals.walkabilityScore
  };
}

// src/engines/district/identity/inferPocketIdentity.ts
function inferPocketIdentity(refinedPockets) {
  return refinedPockets.map((pocket) => {
    const signals = computeIdentitySignals(pocket);
    const identity = makeIdentityDecision(pocket, signals);
    return {
      ...pocket,
      identity
    };
  });
}

// src/engines/district/location/resolveLocation.ts
var DEFAULT_RADIUS_M = 2500;
var MIN_RADIUS_M = 400;
var MAX_RADIUS_M = 12e3;
var SAN_JOSE_CENTER = {
  lat: 37.3382,
  lng: -121.8863
};
var DENVER_CENTER = {
  lat: 39.7392,
  lng: -104.9903
};
var LOCATION_HINTS = [
  {
    tokens: ["san jose", "sanjose"],
    center: SAN_JOSE_CENTER,
    radiusM: 5e3,
    city: "San Jose"
  },
  {
    tokens: ["downtown san jose", "san jose downtown"],
    center: { lat: 37.3352, lng: -121.8863 },
    radiusM: 2200,
    city: "San Jose",
    neighborhood: "Downtown"
  },
  {
    tokens: ["sofa"],
    center: { lat: 37.3329, lng: -121.8883 },
    radiusM: 1800,
    city: "San Jose",
    neighborhood: "SoFA District"
  },
  {
    tokens: ["santana row", "santana"],
    center: { lat: 37.3208, lng: -121.9482 },
    radiusM: 1800,
    city: "San Jose",
    neighborhood: "Santana Row"
  },
  {
    tokens: ["willow glen"],
    center: { lat: 37.3051, lng: -121.9019 },
    radiusM: 2e3,
    city: "San Jose",
    neighborhood: "Willow Glen"
  },
  {
    tokens: ["japantown", "j town", "j-town"],
    center: { lat: 37.3489, lng: -121.8945 },
    radiusM: 1700,
    city: "San Jose",
    neighborhood: "Japantown"
  },
  {
    tokens: ["denver", "denver co", "denver colorado", "denver, co"],
    center: DENVER_CENTER,
    radiusM: 6200,
    city: "Denver"
  },
  {
    tokens: ["lodo", "lo do", "lower downtown", "downtown denver"],
    center: { lat: 39.7527, lng: -104.9993 },
    radiusM: 2200,
    city: "Denver",
    neighborhood: "Downtown / LoDo"
  },
  {
    tokens: ["rino", "ri no", "river north"],
    center: { lat: 39.7688, lng: -104.9799 },
    radiusM: 2100,
    city: "Denver",
    neighborhood: "RiNo"
  },
  {
    tokens: ["cherry creek"],
    center: { lat: 39.7197, lng: -104.9522 },
    radiusM: 2e3,
    city: "Denver",
    neighborhood: "Cherry Creek"
  },
  {
    tokens: ["highlands", "lohi", "lo hi"],
    center: { lat: 39.7583, lng: -105.013 },
    radiusM: 2100,
    city: "Denver",
    neighborhood: "Highlands / LoHi"
  }
];
var AMBIGUOUS_QUERIES = /* @__PURE__ */ new Set([
  "downtown",
  "midtown",
  "uptown",
  "city center",
  "city centre"
]);
function normalizeQuery(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function clamp4(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toTitleCase2(value) {
  return value.split(" ").filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}
function parseCityStateQuery(query) {
  const match = query.trim().match(/^([a-zA-Z][a-zA-Z .'-]{1,})\s*,\s*([a-zA-Z]{2})$/);
  if (!match) {
    return void 0;
  }
  const city = toTitleCase2(match[1].trim().replace(/\s+/g, " "));
  const stateCode = match[2].toUpperCase();
  if (!city || !stateCode) {
    return void 0;
  }
  return { city, stateCode };
}
function parseLatLngQuery(query) {
  const match = query.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!match) {
    return void 0;
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return void 0;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return void 0;
  }
  return { lat, lng };
}
function resolveFromHint(normalizedQuery) {
  const matches = LOCATION_HINTS.filter(
    (hint) => hint.tokens.some((token) => normalizedQuery.includes(token))
  );
  if (matches.length === 0) {
    return void 0;
  }
  return matches.sort((left, right) => {
    const leftTokenLength = Math.max(...left.tokens.map((token) => token.length));
    const rightTokenLength = Math.max(...right.tokens.map((token) => token.length));
    if (rightTokenLength !== leftTokenLength) {
      return rightTokenLength - leftTokenLength;
    }
    return left.city.localeCompare(right.city);
  })[0];
}
function resolveLocation(input) {
  const normalizedQuery = normalizeQuery(input.locationQuery);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  if (input.userLatLng) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: input.locationQuery.trim() || "Current location",
      center: input.userLatLng,
      radiusM: clamp4(input.searchRadiusM ?? DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: "high",
      source: "user_lat_lng",
      meta: {
        geocoder: "manual-user-location",
        resolvedAtIso: nowIso
      }
    };
  }
  const parsedLatLng = parseLatLngQuery(normalizedQuery);
  if (parsedLatLng) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: input.locationQuery.trim(),
      center: parsedLatLng,
      radiusM: clamp4(input.searchRadiusM ?? DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: "medium",
      source: "query_coordinates",
      meta: {
        geocoder: "query-coordinate-parser",
        resolvedAtIso: nowIso
      }
    };
  }
  if (!normalizedQuery) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: "Location required",
      center: SAN_JOSE_CENTER,
      radiusM: clamp4(input.searchRadiusM ?? DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: "low",
      source: "unresolved_query",
      meta: {
        geocoder: "heuristic-location-hints",
        unresolvedReason: 'Enter a city or neighborhood (for example: "San Jose, CA" or "Denver, CO").',
        resolvedAtIso: nowIso
      }
    };
  }
  const hint = resolveFromHint(normalizedQuery);
  if (hint) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: hint.neighborhood ? `${hint.neighborhood}, ${hint.city}` : hint.city,
      center: hint.center,
      radiusM: clamp4(input.searchRadiusM ?? hint.radiusM, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: normalizedQuery.length > 0 ? "medium" : "low",
      source: "query_lookup",
      meta: {
        city: hint.city,
        neighborhood: hint.neighborhood,
        countryCode: "US",
        geocoder: "heuristic-location-hints",
        resolvedAtIso: nowIso
      }
    };
  }
  const parsedCityState = parseCityStateQuery(input.locationQuery);
  if (parsedCityState) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: `${parsedCityState.city}, ${parsedCityState.stateCode}`,
      center: getPseudoCityCenter(parsedCityState.city),
      radiusM: clamp4(input.searchRadiusM ?? 6200, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: "low",
      source: "query_lookup",
      meta: {
        city: parsedCityState.city,
        countryCode: "US",
        geocoder: "heuristic-city-state-parser",
        resolvedAtIso: nowIso
      }
    };
  }
  const unresolvedReason = AMBIGUOUS_QUERIES.has(normalizedQuery) ? 'Location is ambiguous. Include city/state (for example: "Downtown San Jose" or "Downtown Denver").' : `Could not resolve "${input.locationQuery.trim()}". Try "City, ST".`;
  return {
    query: input.locationQuery,
    normalizedQuery,
    displayLabel: input.locationQuery.trim() || "Unresolved location",
    center: SAN_JOSE_CENTER,
    radiusM: clamp4(input.searchRadiusM ?? DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M),
    confidence: "low",
    source: "unresolved_query",
    meta: {
      geocoder: "heuristic-location-hints",
      unresolvedReason,
      resolvedAtIso: nowIso
    }
  };
}

// src/engines/district/ranking/rankAndSelectPockets.ts
var DEFAULT_SELECT_LIMIT = 6;
var SECONDARY_POCKET_SURVIVAL_BAND = 0.2;
function clamp5(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function getSetOverlap(left, right) {
  const leftSet = new Set(left.map((value) => value.toLowerCase()));
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersection += 1;
    }
  }
  const unionSize = (/* @__PURE__ */ new Set([...leftSet, ...rightSet])).size;
  return unionSize > 0 ? intersection / unionSize : 0;
}
function getDominantMixChannel(profile) {
  const mix = profile.tasteSignals.hospitalityMix;
  return Object.entries(mix).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? "activity";
}
function getSecondaryVarietyGain(profile, retainedProfiles) {
  if (retainedProfiles.length === 0) {
    return 0;
  }
  const familyContrastScore = retainedProfiles.filter(
    (entry) => entry.tasteSignals.experientialTags.some(
      (tag) => !profile.tasteSignals.experientialTags.includes(tag)
    )
  ).length / retainedProfiles.length;
  const archetypeContrastScore = retainedProfiles.filter(
    (entry) => getDominantMixChannel(entry) !== getDominantMixChannel(profile)
  ).length / retainedProfiles.length;
  const identityContrastScore = retainedProfiles.filter(
    (entry) => getSetOverlap(entry.categories, profile.categories) < 0.4
  ).length / retainedProfiles.length;
  const anchorId = profile.hyperlocal?.primaryAnchor?.entityId;
  const distinctAnchorScore = anchorId && retainedProfiles.every((entry) => entry.hyperlocal?.primaryAnchor?.entityId !== anchorId) ? 1 : 0;
  const interpretableShapeScore = clamp5(
    (profile.hyperlocal?.primaryMicroPocket.identityStrength ?? 0.5) * 0.56 + (profile.hyperlocal?.primaryMicroPocket.coherenceScore ?? 0.5) * 0.44,
    0,
    1
  );
  return clamp5(
    familyContrastScore * 0.26 + archetypeContrastScore * 0.24 + identityContrastScore * 0.2 + distinctAnchorScore * 0.14 + interpretableShapeScore * 0.16,
    0,
    1
  );
}
function buildReasons(profile) {
  return [
    `Score ${profile.score.totalScore} with viability ${profile.classification}.`,
    `${profile.entityCount} entities and ${profile.categories.length} leading categories.`,
    `Walkability ${profile.coreSignals.walkability}, density ${profile.coreSignals.density}.`
  ];
}
function rankAndSelectPockets(profiles, selectLimit = DEFAULT_SELECT_LIMIT) {
  const sorted = [...profiles].sort((left, right) => {
    if (right.score.totalScore !== left.score.totalScore) {
      return right.score.totalScore - left.score.totalScore;
    }
    if (right.coreSignals.viability !== left.coreSignals.viability) {
      return right.coreSignals.viability - left.coreSignals.viability;
    }
    if (right.entityCount !== left.entityCount) {
      return right.entityCount - left.entityCount;
    }
    return left.label.localeCompare(right.label);
  });
  const ranked = sorted.map((profile, index) => ({
    rank: index + 1,
    score: profile.score.totalScore,
    reasons: buildReasons(profile),
    profile
  }));
  const baseSelected = ranked.slice(0, Math.max(1, selectLimit));
  const topScore = ranked[0]?.score ?? 0;
  const secondarySurvivors = ranked.filter((entry) => {
    if (entry.rank <= 1) {
      return false;
    }
    if (entry.profile.classification === "weak" || entry.profile.classification === "reject") {
      return false;
    }
    return topScore - entry.score <= SECONDARY_POCKET_SURVIVAL_BAND;
  }).sort((left, right) => {
    const leftGain = getSecondaryVarietyGain(
      left.profile,
      baseSelected.map((entry) => entry.profile)
    );
    const rightGain = getSecondaryVarietyGain(
      right.profile,
      baseSelected.map((entry) => entry.profile)
    );
    if (rightGain !== leftGain) {
      return rightGain - leftGain;
    }
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.profile.pocketId.localeCompare(right.profile.pocketId);
  });
  const selectedPocketIds = /* @__PURE__ */ new Set();
  const selected = [...baseSelected, ...secondarySurvivors].filter((entry) => {
    if (selectedPocketIds.has(entry.profile.pocketId)) {
      return false;
    }
    selectedPocketIds.add(entry.profile.pocketId);
    return true;
  });
  return {
    ranked,
    selected
  };
}

// src/engines/district/refinement/mergePockets.ts
function mergePockets(pockets) {
  return pockets;
}

// src/engines/district/refinement/splitPocket.ts
function splitPocket(pocket) {
  return [pocket];
}

// src/engines/district/refinement/refinePocketsWithSplitMerge.ts
function refinePocketsWithSplitMerge(viablePockets) {
  const splitStage = viablePockets.flatMap((pocket) => splitPocket(pocket));
  const mergedStage = mergePockets(splitStage);
  return mergedStage.map((pocket) => ({
    ...pocket,
    refinement: {
      status: "unchanged",
      actions: [
        {
          action: "keep",
          note: "Phase 1-3 pass-through refinement."
        }
      ]
    }
  }));
}

// src/engines/district/scoring/computeBearingsLite.ts
function toFixed3(value) {
  return Number(Math.max(-1, Math.min(1, value)).toFixed(3));
}
function computeBearingsLite(pocket) {
  const width = pocket.geometry.bboxWidthM;
  const height = pocket.geometry.bboxHeightM;
  const base = Math.max(1, width + height);
  const northSouthBias = toFixed3((height - width) / base);
  const eastWestBias = toFixed3((width - height) / base);
  const dominantAxis = Math.abs(northSouthBias) < 0.08 ? "balanced" : northSouthBias > 0 ? "north_south" : "east_west";
  return {
    northSouthBias,
    eastWestBias,
    dominantAxis
  };
}

// src/engines/district/scoring/computeDistrictScores.ts
function clamp6(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toFixed4(value) {
  return Number(value.toFixed(3));
}
var VIABILITY_BONUS_BY_CLASS = {
  strong: 0.09,
  usable: 0.05,
  weak: 0.01,
  reject: 0
};
function computeDistrictScores(fieldSignals, viabilityClass) {
  const normalizedEntityCount = clamp6(fieldSignals.entityCount / 10, 0, 1);
  const fieldScore = normalizedEntityCount * 0.26 + fieldSignals.categoryDiversity * 0.2 + fieldSignals.density * 0.18 + fieldSignals.walkability * 0.2 + fieldSignals.viability * 0.16;
  const viabilityBonus = VIABILITY_BONUS_BY_CLASS[viabilityClass];
  const totalScore = clamp6(fieldScore + viabilityBonus, 0, 1);
  return {
    fieldScore: toFixed4(fieldScore),
    viabilityBonus: toFixed4(viabilityBonus),
    totalScore: toFixed4(totalScore)
  };
}

// src/engines/district/scoring/computeFieldSignals.ts
function clamp7(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toFixed5(value) {
  return Number(value.toFixed(3));
}
function computeFieldSignals(pocket) {
  return {
    entityCount: pocket.entities.length,
    categoryDiversity: toFixed5(pocket.viability.signals.categoryDiversity),
    density: toFixed5(clamp7(pocket.viability.signals.densityScore, 0, 1)),
    walkability: toFixed5(clamp7(pocket.viability.signals.walkabilityScore, 0, 1)),
    viability: toFixed5(clamp7(pocket.viability.score, 0, 1))
  };
}

// src/engines/district/scoring/resolveMicroPockets.ts
function clamp8(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toFixed6(value) {
  return Number(value.toFixed(3));
}
function countByKey(values) {
  const counts = /* @__PURE__ */ new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.key.localeCompare(right.key);
  });
}
function getPrimaryCategory(entity) {
  return entity.categories[0] ?? entity.type;
}
function getMicroRadiusM(entities, centroid) {
  if (entities.length === 0) {
    return 0;
  }
  return entities.reduce((maxValue, entity) => {
    const distance = haversineDistanceM(entity.location, centroid);
    return distance > maxValue ? distance : maxValue;
  }, 0);
}
function computeAnchorCandidateIds(entities, dominantCategories, dominantLanes, centroid, radiusM) {
  if (entities.length === 0) {
    return [];
  }
  const supportBandM = Math.max(80, radiusM * 0.8);
  return entities.map((entity) => {
    const distanceToCentroid = haversineDistanceM(entity.location, centroid);
    const proximityScore = clamp8(1 - distanceToCentroid / Math.max(120, radiusM * 1.2), 0, 1);
    const category = getPrimaryCategory(entity);
    const categoryAlignment = dominantCategories.includes(category) ? 1 : 0.45;
    const laneAlignment = dominantLanes.includes(entity.type) ? 1 : 0.5;
    const supportCount = entities.filter((candidate) => {
      if (candidate.id === entity.id) {
        return false;
      }
      return haversineDistanceM(candidate.location, entity.location) <= supportBandM;
    }).length;
    const supportDensityScore = clamp8(supportCount / Math.max(1, entities.length - 1), 0, 1);
    const experienceForwardSignal = ["activity", "event", "program", "hub"].includes(entity.type) || entity.categories.some(
      (value) => ["bar", "restaurant", "cafe", "museum", "event", "activity"].includes(
        value.toLowerCase()
      )
    ) ? 1 : 0.42;
    const score = proximityScore * 0.34 + categoryAlignment * 0.24 + laneAlignment * 0.18 + supportDensityScore * 0.14 + experienceForwardSignal * 0.1;
    return {
      entityId: entity.id,
      score
    };
  }).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.entityId.localeCompare(right.entityId);
  }).slice(0, 4).map((entry) => entry.entityId);
}
function buildMicroPocket(pocketId, entities, index) {
  const centroid = centroidOf(entities.map((entity) => entity.location));
  const radiusM = getMicroRadiusM(entities, centroid);
  const categoryCounts = countByKey(entities.map((entity) => getPrimaryCategory(entity)));
  const laneCounts = countByKey(entities.map((entity) => entity.type));
  const dominantCategories = categoryCounts.slice(0, 3).map((entry) => entry.key);
  const dominantLanes = laneCounts.slice(0, 3).map((entry) => entry.key);
  const categoryDiversity = clamp8(categoryCounts.length / 5, 0, 1);
  const laneDiversity = clamp8(laneCounts.length / 4, 0, 1);
  const compactness = clamp8(1 - radiusM / 260, 0, 1);
  const categoryDominance = entities.length > 0 ? categoryCounts[0].count / entities.length : 0;
  const laneDominance = entities.length > 0 ? laneCounts[0].count / entities.length : 0;
  const coherenceScore = clamp8(
    compactness * 0.34 + (1 - categoryDominance) * 0.16 + (1 - laneDominance) * 0.15 + categoryDiversity * 0.18 + laneDiversity * 0.17,
    0,
    1
  );
  const densitySignal = clamp8(
    entities.length / Math.max(1, Math.pow(Math.max(55, radiusM), 2)) * 4200,
    0,
    1
  );
  const experienceForwardCount = entities.filter(
    (entity) => ["activity", "event", "program", "hub"].includes(entity.type) || entity.categories.some(
      (category) => ["bar", "restaurant", "cafe", "museum", "event", "activity"].includes(
        category.toLowerCase()
      )
    )
  ).length;
  const experienceForwardSignal = clamp8(
    experienceForwardCount / Math.max(1, entities.length),
    0,
    1
  );
  const identityStrength = clamp8(
    coherenceScore * 0.3 + categoryDiversity * 0.18 + laneDiversity * 0.14 + (experienceForwardSignal >= 0.55 ? 0.2 : 0.09) + (categoryDiversity >= 0.6 && laneDiversity >= 0.5 ? 0.18 : 0.08),
    0,
    1
  );
  const activationStrength = clamp8(
    densitySignal * 0.42 + categoryDiversity * 0.2 + laneDiversity * 0.14 + compactness * 0.12 + experienceForwardSignal * 0.12,
    0,
    1
  );
  const categoryMixAdaptability = clamp8(
    categoryCounts.filter((entry) => entry.count >= 1).length / 6,
    0,
    1
  );
  const environmentalInfluencePotential = clamp8(
    activationStrength * 0.48 + categoryMixAdaptability * 0.24 + categoryDiversity * 0.16 + densitySignal * 0.12,
    0,
    1
  );
  const reasonSignals = [];
  if (activationStrength >= 0.62) {
    reasonSignals.push("high_activation_core");
  } else if (activationStrength >= 0.48) {
    reasonSignals.push("steady_activation_base");
  }
  if (identityStrength >= 0.64) {
    reasonSignals.push("identity_forward_mix");
  } else if (identityStrength >= 0.5) {
    reasonSignals.push("identity_coherent_mix");
  }
  if (environmentalInfluencePotential >= 0.6) {
    reasonSignals.push("strong_environmental_influence");
  }
  if (compactness >= 0.58) {
    reasonSignals.push("tight_walkable_micro_pocket");
  }
  if (reasonSignals.length === 0) {
    reasonSignals.push("baseline_micro_pocket");
  }
  return {
    id: `${pocketId}-micro-${index + 1}`,
    centroid,
    radiusM: toFixed6(radiusM),
    entityIds: entities.map((entity) => entity.id),
    dominantCategories,
    dominantLanes,
    coherenceScore: toFixed6(coherenceScore),
    identityStrength: toFixed6(identityStrength),
    activationStrength: toFixed6(activationStrength),
    environmentalInfluencePotential: toFixed6(environmentalInfluencePotential),
    anchorCandidateIds: computeAnchorCandidateIds(
      entities,
      dominantCategories,
      dominantLanes,
      centroid,
      radiusM
    ),
    reasonSignals
  };
}
function rankMicroPockets(microPockets) {
  return microPockets.slice().sort((left, right) => {
    const leftScore = left.identityStrength * 0.34 + left.activationStrength * 0.31 + left.environmentalInfluencePotential * 0.21 + left.coherenceScore * 0.14;
    const rightScore = right.identityStrength * 0.34 + right.activationStrength * 0.31 + right.environmentalInfluencePotential * 0.21 + right.coherenceScore * 0.14;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    if (right.entityIds.length !== left.entityIds.length) {
      return right.entityIds.length - left.entityIds.length;
    }
    return left.id.localeCompare(right.id);
  });
}
function resolveMicroPockets(pocket) {
  const entities = pocket.entities;
  if (entities.length <= 2) {
    return {
      microPockets: rankMicroPockets([buildMicroPocket(pocket.id, entities, 0)])
    };
  }
  const epsM = clamp8(pocket.geometry.maxDistanceFromCentroidM * 0.42, 70, 180);
  const minPoints = entities.length >= 9 ? 3 : 2;
  const clustering = dbscan({
    points: entities,
    epsM,
    minPoints,
    distance: (left, right) => haversineDistanceM(left.location, right.location)
  });
  const clustered = clustering.clusters.map((cluster, index) => buildMicroPocket(pocket.id, cluster.points, index)).filter((microPocket) => microPocket.entityIds.length > 0);
  if (clustered.length === 0) {
    return {
      microPockets: rankMicroPockets([buildMicroPocket(pocket.id, entities, 0)])
    };
  }
  return {
    microPockets: rankMicroPockets(clustered)
  };
}

// src/engines/district/scoring/scoreIdentityAnchors.ts
function clamp9(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toFixed7(value) {
  return Number(value.toFixed(3));
}
function getPrimaryCategory2(entity) {
  return entity.categories[0] ?? entity.type;
}
function buildAnchorScore(entity, pocketEntities, primaryMicroPocket) {
  const distanceToMicroCenter = haversineDistanceM(entity.location, primaryMicroPocket.centroid);
  const proximityBandM = Math.max(120, primaryMicroPocket.radiusM * 1.25);
  const proximityScore = clamp9(1 - distanceToMicroCenter / proximityBandM, 0, 1);
  const category = getPrimaryCategory2(entity);
  const identityAlignment = (primaryMicroPocket.dominantCategories.includes(category) ? 0.62 : 0.26) + (primaryMicroPocket.dominantLanes.includes(entity.type) ? 0.38 : 0.18);
  const supportBandM = Math.max(90, primaryMicroPocket.radiusM * 0.9);
  const supportCount = pocketEntities.filter((candidate) => {
    if (candidate.id === entity.id) {
      return false;
    }
    return haversineDistanceM(candidate.location, entity.location) <= supportBandM;
  }).length;
  const supportDensity = clamp9(supportCount / Math.max(1, pocketEntities.length - 1), 0, 1);
  const activationLift = primaryMicroPocket.activationStrength * 0.58 + primaryMicroPocket.environmentalInfluencePotential * 0.42;
  const genericPenalty = !primaryMicroPocket.dominantCategories.includes(category) && !primaryMicroPocket.dominantLanes.includes(entity.type) ? 0.08 : 0;
  const isolatedPenalty = supportDensity < 0.2 ? 0.08 : supportDensity < 0.34 ? 0.04 : 0;
  const score = clamp9(
    proximityScore * 0.33 + identityAlignment * 0.24 + supportDensity * 0.2 + activationLift * 0.17 - genericPenalty - isolatedPenalty,
    0,
    1
  );
  const reasons = [];
  if (proximityScore >= 0.62) {
    reasons.push("near_primary_micro_core");
  }
  if (identityAlignment >= 0.68) {
    reasons.push("identity_aligned_anchor");
  } else if (identityAlignment >= 0.5) {
    reasons.push("partial_identity_alignment");
  }
  if (supportDensity >= 0.48) {
    reasons.push("strong_local_support_density");
  }
  if (activationLift >= 0.58) {
    reasons.push("activation_supported_anchor");
  }
  if (reasons.length === 0) {
    reasons.push("fallback_anchor_signal");
  }
  return {
    entityId: entity.id,
    entityName: entity.name,
    score: toFixed7(score),
    reasons
  };
}
function scoreIdentityAnchors({
  pocket,
  microPockets
}) {
  const primaryMicroPocket = microPockets[0];
  if (!primaryMicroPocket) {
    return {
      primaryAnchor: void 0,
      secondaryAnchors: [],
      rankedAnchors: []
    };
  }
  const rankedAnchors = pocket.entities.map((entity) => buildAnchorScore(entity, pocket.entities, primaryMicroPocket)).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.entityId.localeCompare(right.entityId);
  });
  const primaryAnchor = rankedAnchors[0];
  return {
    primaryAnchor,
    secondaryAnchors: rankedAnchors.slice(1, 4),
    rankedAnchors: rankedAnchors.slice(0, 6)
  };
}

// src/engines/district/scoring/computeTasteBridgeSignals.ts
var CATEGORY_TO_MIX_WEIGHTS = {
  bar: [{ key: "drinks", weight: 1 }],
  restaurant: [{ key: "dining", weight: 1 }],
  cafe: [{ key: "cafe", weight: 1 }],
  museum: [{ key: "culture", weight: 1 }],
  event: [
    { key: "activity", weight: 0.6 },
    { key: "culture", weight: 0.4 }
  ],
  activity: [{ key: "activity", weight: 1 }],
  park: [{ key: "activity", weight: 0.75 }, { key: "culture", weight: 0.25 }],
  live_music: [{ key: "culture", weight: 0.6 }, { key: "drinks", weight: 0.4 }],
  dessert: [{ key: "dining", weight: 0.55 }, { key: "cafe", weight: 0.45 }]
};
function clamp10(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toFixed8(value) {
  return Number(clamp10(value, 0, 1).toFixed(3));
}
function toLevel(value) {
  if (value >= 0.67) {
    return "high";
  }
  if (value >= 0.34) {
    return "medium";
  }
  return "low";
}
function normalizeMix(rawMix) {
  const total = Object.values(rawMix).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return {
      drinks: 0,
      dining: 0,
      culture: 0,
      cafe: 0,
      activity: 0
    };
  }
  return {
    drinks: toFixed8(rawMix.drinks / total),
    dining: toFixed8(rawMix.dining / total),
    culture: toFixed8(rawMix.culture / total),
    cafe: toFixed8(rawMix.cafe / total),
    activity: toFixed8(rawMix.activity / total)
  };
}
function computeHospitalityMix(pocket) {
  const rawMix = {
    drinks: 0,
    dining: 0,
    culture: 0,
    cafe: 0,
    activity: 0
  };
  for (const [category, count] of Object.entries(pocket.categoryCounts)) {
    const mapping = CATEGORY_TO_MIX_WEIGHTS[category] ?? CATEGORY_TO_MIX_WEIGHTS[category.toLowerCase()] ?? [{ key: "activity", weight: 1 }];
    for (const entry of mapping) {
      rawMix[entry.key] += count * entry.weight;
    }
  }
  return normalizeMix(rawMix);
}
function getDominantMixKey(mix) {
  return Object.entries(mix).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? "activity";
}
function deriveExperientialTags(mix, energyScore, noiseScore, intimacyScore) {
  const tags = /* @__PURE__ */ new Set();
  const dominantMix = getDominantMixKey(mix);
  const strongestWeight = Math.max(...Object.values(mix));
  if (dominantMix === "drinks" && mix.drinks >= 0.26) {
    tags.add("drinks-forward");
  }
  if (dominantMix === "dining" && mix.dining >= 0.3) {
    tags.add("dining-forward");
  }
  if (mix.culture >= 0.2) {
    tags.add("arts-adjacent");
  }
  if (mix.cafe >= 0.26) {
    tags.add("coffee-leaning");
  }
  if (mix.activity >= 0.34) {
    tags.add("activity-led");
  }
  if (energyScore >= 0.55) {
    tags.add("lively");
  }
  if (energyScore <= 0.35) {
    tags.add("slow-paced");
  }
  if (intimacyScore >= 0.6 && noiseScore <= 0.65) {
    tags.add("intimate");
  }
  if (strongestWeight < 0.34) {
    tags.add("mixed-program");
  }
  return Array.from(tags).sort((left, right) => left.localeCompare(right));
}
function deriveMomentSeeds(mix) {
  const seeds = [];
  const dominantMix = getDominantMixKey(mix);
  if (mix.drinks >= 0.18 && mix.culture >= 0.18) {
    seeds.push("gallery -> wine bar");
  }
  if (mix.cafe >= 0.14 && mix.activity >= 0.25) {
    seeds.push("coffee start");
  }
  if (mix.culture >= 0.2 && mix.activity >= 0.25) {
    seeds.push("gallery stroll");
  }
  if (dominantMix === "dining" && mix.dining >= 0.3) {
    seeds.push("dinner anchor");
  }
  if (mix.cafe >= 0.3) {
    seeds.push("coffee + walk");
  }
  if (mix.drinks >= 0.3) {
    seeds.push("cocktail-forward start");
  }
  if (mix.culture >= 0.3) {
    seeds.push("museum + listening room");
  }
  if (mix.activity >= 0.34) {
    seeds.push("playful detour");
  }
  if (seeds.length === 0) {
    seeds.push("neighborhood sampler");
  }
  return Array.from(new Set(seeds)).slice(0, 5);
}
function computeTasteBridgeSignals(pocket) {
  const hospitalityMix = computeHospitalityMix(pocket);
  const density = clamp10(pocket.viability.signals.densityScore, 0, 1);
  const diversity = clamp10(pocket.viability.signals.categoryDiversity, 0, 1);
  const compactness = clamp10(
    1 - (Math.max(1, pocket.geometry.elongationRatio) - 1) / 3,
    0,
    1
  );
  const spreadTightness = clamp10(
    1 - pocket.geometry.maxDistanceFromCentroidM / 460,
    0,
    1
  );
  const energyScore = clamp10(
    density * 0.45 + hospitalityMix.activity * 0.35 + hospitalityMix.drinks * 0.2,
    0,
    1
  );
  const noiseScore = clamp10(
    energyScore * 0.55 + hospitalityMix.drinks * 0.25 + hospitalityMix.activity * 0.2,
    0,
    1
  );
  const intimacyScore = clamp10(
    compactness * 0.35 + spreadTightness * 0.25 + (1 - noiseScore) * 0.2 + (hospitalityMix.cafe + hospitalityMix.dining) * 0.2,
    0,
    1
  );
  const compositionRichness = clamp10(
    Object.values(hospitalityMix).filter((weight) => weight >= 0.12).length / 5,
    0,
    1
  );
  const momentPotential = toFixed8(
    diversity * 0.35 + density * 0.25 + compositionRichness * 0.4
  );
  return {
    experientialTags: deriveExperientialTags(
      hospitalityMix,
      energyScore,
      noiseScore,
      intimacyScore
    ),
    hospitalityMix,
    ambianceProfile: {
      energy: toLevel(energyScore),
      intimacy: toLevel(intimacyScore),
      noise: toLevel(noiseScore)
    },
    momentSeeds: deriveMomentSeeds(hospitalityMix),
    momentPotential
  };
}

// src/engines/district/scoring/computeTasteLite.ts
function toFixed9(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}
function computeTasteLite(pocket) {
  const socialDensity = toFixed9(
    pocket.entities.reduce((sum, entity) => sum + (entity.signals?.activity ?? 0), 0) / Math.max(1, pocket.entities.length)
  );
  const confidence = toFixed9(
    pocket.entities.reduce((sum, entity) => sum + (entity.signals?.trust ?? 0), 0) / Math.max(1, pocket.entities.length)
  );
  return {
    socialDensity,
    confidence
  };
}

// src/engines/district/scoring/assemblePocketProfiles.ts
function clamp11(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toFixed10(value) {
  return Number(value.toFixed(3));
}
function toCoreVertical(vertical) {
  return vertical ?? "generic";
}
function buildWhyHereSignals(input) {
  const signals = Array.from(
    /* @__PURE__ */ new Set([...input.primaryReasons, ...input.secondaryReasons, ...input.anchorReasons])
  ).slice(0, 5);
  if (signals.length === 0) {
    return ["baseline_local_specificity"];
  }
  if (!input.hasStrongIdentity && !input.hasStrongActivation) {
    return [...signals, "low_specificity_fallback"].slice(0, 5);
  }
  return signals;
}
function buildHyperlocal(pocket) {
  const microPocketResolution = resolveMicroPockets(pocket);
  const primaryMicroPocket = microPocketResolution.microPockets[0];
  if (!primaryMicroPocket) {
    return void 0;
  }
  const secondaryMicroPockets = microPocketResolution.microPockets.slice(1, 3);
  const anchorScores = scoreIdentityAnchors({
    pocket,
    microPockets: microPocketResolution.microPockets
  });
  const hasStrongIdentity = primaryMicroPocket.identityStrength >= 0.56;
  const hasStrongActivation = primaryMicroPocket.activationStrength >= 0.56;
  const whyHereSignals = buildWhyHereSignals({
    primaryReasons: primaryMicroPocket.reasonSignals,
    secondaryReasons: secondaryMicroPockets.flatMap((entry) => entry.reasonSignals).slice(0, 2),
    anchorReasons: anchorScores.primaryAnchor?.reasons ?? [],
    hasStrongIdentity,
    hasStrongActivation
  });
  const localSpecificityScore = toFixed10(
    clamp11(
      primaryMicroPocket.identityStrength * 0.34 + primaryMicroPocket.activationStrength * 0.24 + primaryMicroPocket.environmentalInfluencePotential * 0.22 + (anchorScores.primaryAnchor?.score ?? 0) * 0.2,
      0,
      1
    )
  );
  return {
    primaryMicroPocket,
    secondaryMicroPockets,
    primaryAnchor: anchorScores.primaryAnchor,
    secondaryAnchors: anchorScores.secondaryAnchors,
    whyHereSignals,
    localSpecificityScore
  };
}
function assemblePocketProfiles(identifiedPockets, context = {}) {
  const vertical = toCoreVertical(context.vertical);
  return identifiedPockets.map((pocket) => {
    const fieldSignals = computeFieldSignals(pocket);
    const tasteSignals = computeTasteBridgeSignals(pocket);
    const score = computeDistrictScores(fieldSignals, pocket.viability.classification);
    const sortedCategories = Object.entries(pocket.categoryCounts).sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    }).map(([category]) => category);
    const appSignals = vertical === "generic" ? void 0 : {
      directionSignals: computeBearingsLite(pocket),
      tasteSignals: computeTasteLite(pocket)
    };
    const hyperlocal = buildHyperlocal(pocket);
    return {
      pocketId: pocket.id,
      label: pocket.identity.pocketLabel,
      centroid: pocket.geometry.centroid,
      radiusM: pocket.geometry.maxDistanceFromCentroidM,
      entityCount: pocket.entities.length,
      categories: sortedCategories,
      classification: pocket.viability.classification,
      coreSignals: fieldSignals,
      tasteSignals,
      score,
      appSignals,
      hyperlocal,
      meta: {
        vertical,
        provenance: [
          "district-engine",
          "phase-1-3",
          "neutral-pocket-profile",
          `origin:${pocket.origin}`,
          ...appSignals ? ["optional-app-projection"] : [],
          ...hyperlocal ? ["hyperlocal-layer-v1"] : []
        ],
        generatedAtIso: (/* @__PURE__ */ new Date()).toISOString(),
        identityKind: pocket.identity.kind,
        origin: pocket.origin,
        clusteringSource: pocket.originMeta.clusteringSource,
        originNotes: pocket.originMeta.stageNotes,
        sourcePocketId: pocket.originMeta.sourcePocketId
      }
    };
  });
}

// src/engines/district/viability/applyPocketViabilityRules.ts
var DEFAULT_THRESHOLDS = {
  minEntities: 5,
  softMinEntities: 3,
  hardRejectBelow: 3,
  hardMaxCentroidDistanceM: 650
};
function clamp12(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toFixed11(value) {
  return Number(value.toFixed(3));
}
var DENSITY_SCORE_BASELINE = 260;
function computeViabilitySignals(pocket, thresholds) {
  const entityCount = pocket.entities.length;
  const densityScore = clamp12(pocket.geometry.densityEntitiesPerKm2 / DENSITY_SCORE_BASELINE, 0, 1);
  const walkabilityScore = clamp12(1 - pocket.geometry.avgDistanceFromCentroidM / 260, 0, 1) * 0.75 + clamp12(1 - pocket.geometry.maxPairwiseDistanceM / 950, 0, 1) * 0.25;
  const compactnessScore = clamp12(
    1 - clamp12((pocket.geometry.elongationRatio - 1) / 3, 0, 1),
    0,
    1
  );
  const radiusPenalty = Math.max(
    0,
    (pocket.geometry.maxDistanceFromCentroidM - thresholds.hardMaxCentroidDistanceM) / thresholds.hardMaxCentroidDistanceM
  );
  return {
    entityCount,
    categoryDiversity: toFixed11(pocket.laneDiversityScore),
    densityScore: toFixed11(densityScore),
    walkabilityScore: toFixed11(walkabilityScore),
    compactnessScore: toFixed11(compactnessScore),
    radiusPenalty: toFixed11(radiusPenalty)
  };
}
function computeViabilityScore(signals) {
  const entityCountScore = clamp12(signals.entityCount / 9, 0, 1);
  const score = entityCountScore * 0.25 + signals.categoryDiversity * 0.2 + signals.densityScore * 0.18 + signals.walkabilityScore * 0.23 + signals.compactnessScore * 0.14 - signals.radiusPenalty * 0.18;
  return toFixed11(clamp12(score, 0, 1));
}
function buildClassification(pocket, signals, score, thresholds) {
  const entityCount = pocket.entities.length;
  if (entityCount < thresholds.hardRejectBelow) {
    return "reject";
  }
  if (pocket.geometry.maxDistanceFromCentroidM > thresholds.hardMaxCentroidDistanceM + 120) {
    return "reject";
  }
  if (entityCount >= thresholds.minEntities && score >= 0.72 && pocket.geometry.maxDistanceFromCentroidM <= 470 && signals.categoryDiversity >= 0.35 && signals.walkabilityScore >= 0.55) {
    return "strong";
  }
  if (entityCount >= thresholds.minEntities && score >= 0.52 && pocket.geometry.maxDistanceFromCentroidM <= thresholds.hardMaxCentroidDistanceM && signals.categoryDiversity >= 0.25) {
    return "usable";
  }
  if (entityCount >= thresholds.softMinEntities && score >= 0.34 && signals.walkabilityScore >= 0.2) {
    return "weak";
  }
  return "reject";
}
function buildReasons2(pocket, signals, classification, thresholds) {
  const reasons = [];
  reasons.push(
    `${signals.entityCount} entities, diversity ${signals.categoryDiversity}, density ${signals.densityScore}.`
  );
  reasons.push(
    `Walkability ${signals.walkabilityScore}, compactness ${signals.compactnessScore}, max radius ${pocket.geometry.maxDistanceFromCentroidM}m.`
  );
  if (signals.entityCount < thresholds.hardRejectBelow) {
    reasons.push(`Rejected: below hard minimum of ${thresholds.hardRejectBelow} entities.`);
  } else if (signals.entityCount < thresholds.minEntities) {
    reasons.push(
      `Soft pass: below strong minimum of ${thresholds.minEntities}, classified as ${classification}.`
    );
  }
  if (pocket.geometry.maxDistanceFromCentroidM > thresholds.hardMaxCentroidDistanceM) {
    reasons.push(
      `Spread exceeds hard centroid distance target (${thresholds.hardMaxCentroidDistanceM}m).`
    );
  }
  if (signals.categoryDiversity < 0.25) {
    reasons.push("Low category diversity reduced viability class.");
  }
  if (classification === "strong") {
    reasons.push("Strong pocket: compact, walkable, and diverse enough for multi-stop flow.");
  } else if (classification === "usable") {
    reasons.push("Usable pocket: supports local movement with manageable spread.");
  } else if (classification === "weak") {
    reasons.push("Weak pocket: can be used with caution in sparse conditions.");
  } else {
    reasons.push("Rejected pocket: does not meet minimum spatial viability constraints.");
  }
  return reasons;
}
function toViablePocket(pocket, thresholds) {
  const signals = computeViabilitySignals(pocket, thresholds);
  const score = computeViabilityScore(signals);
  const classification = buildClassification(pocket, signals, score, thresholds);
  const reasons = buildReasons2(pocket, signals, classification, thresholds);
  return {
    ...pocket,
    viability: {
      classification,
      score,
      reasons,
      signals,
      thresholds: {
        minEntities: thresholds.minEntities,
        softMinEntities: thresholds.softMinEntities,
        hardRejectBelow: thresholds.hardRejectBelow,
        hardMaxCentroidDistanceM: thresholds.hardMaxCentroidDistanceM
      }
    }
  };
}
function applyPocketViabilityRules(rawPockets, thresholds = {}) {
  const mergedThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...thresholds
  };
  const evaluated = rawPockets.map((pocket) => toViablePocket(pocket, mergedThresholds));
  const accepted = evaluated.filter((pocket) => pocket.viability.classification !== "reject");
  const rejected = evaluated.filter((pocket) => pocket.viability.classification === "reject");
  return {
    evaluated,
    accepted,
    rejected
  };
}

// src/engines/district/core/buildDistrictOpportunityProfiles.ts
var PRIMARY_CLUSTERING = {
  epsM: 180,
  minPoints: 5,
  maxRadiusCapM: 600
};
var FALLBACK_CLUSTERING = {
  epsM: 240,
  minPoints: 3,
  maxRadiusCapM: 600
};
function withDefaultContext(context = {}) {
  return {
    vertical: context.vertical ?? "generic"
  };
}
function pickBestPocket(pockets) {
  return [...pockets].sort((left, right) => {
    if (right.viability.score !== left.viability.score) {
      return right.viability.score - left.viability.score;
    }
    if (right.entities.length !== left.entities.length) {
      return right.entities.length - left.entities.length;
    }
    return left.id.localeCompare(right.id);
  })[0];
}
function promoteBestReject(viability) {
  const bestRejected = pickBestPocket(viability.rejected);
  if (!bestRejected) {
    return viability;
  }
  const promoted = {
    ...bestRejected,
    origin: "promoted_reject",
    originMeta: {
      ...bestRejected.originMeta,
      stageNotes: [
        ...bestRejected.originMeta.stageNotes,
        `Promoted from rejected pocket with prior origin "${bestRejected.origin}".`
      ],
      sourcePocketId: bestRejected.id
    },
    meta: {
      ...bestRejected.meta,
      provenance: [...bestRejected.meta.provenance, "promoted-reject"]
    },
    viability: {
      ...bestRejected.viability,
      classification: "weak",
      reasons: [
        ...bestRejected.viability.reasons,
        "Sparse fallback promotion applied to avoid empty district output."
      ]
    }
  };
  return {
    evaluated: viability.evaluated.map(
      (pocket) => pocket.id === promoted.id ? promoted : pocket
    ),
    accepted: [promoted],
    rejected: viability.rejected.filter((pocket) => pocket.id !== promoted.id)
  };
}
async function buildDistrictOpportunityProfiles(input, context = {}) {
  const resolvedContext = withDefaultContext(context);
  const stageNotes = [];
  let usedFallbackClustering = false;
  let usedSyntheticFallback = false;
  let usedPromotedReject = false;
  const location = resolveLocation({
    locationQuery: input.locationQuery,
    userLatLng: input.userLatLng,
    searchRadiusM: input.searchRadiusM
  });
  if (location.source === "unresolved_query") {
    stageNotes.push(
      location.meta.unresolvedReason ?? "Location query could not be resolved to a known city or neighborhood."
    );
    const emptyViability = {
      evaluated: [],
      accepted: [],
      rejected: []
    };
    const debug2 = input.includeDebug ? buildDistrictDebugTrace({
      location,
      retrieval: {
        mode: "none",
        city: location.meta.city ?? "",
        curatedCount: 0,
        liveRawFetchedCount: 0,
        liveFetchedCount: 0,
        liveMappedCount: 0,
        liveMappedDroppedCount: 0,
        liveMapDropReasons: {},
        liveNormalizedCount: 0,
        liveNormalizationDroppedCount: 0,
        liveNormalizationDropReasons: {},
        liveAcceptedPreGeoCount: 0,
        liveAcceptedCount: 0,
        liveSuppressedCount: 0,
        liveSuppressionReasons: {},
        geoBucketCount: 0,
        dominantAreaShare: 0,
        geoSpreadScore: 0,
        geoDiversityDownsampledCount: 0,
        bootstrapCount: 0,
        selectedCount: 0,
        notes: [
          location.meta.unresolvedReason ?? "Location query could not be resolved for district retrieval."
        ]
      },
      entityCount: 0,
      rawPockets: [],
      viability: emptyViability,
      refinedPockets: [],
      identifiedPockets: [],
      profiles: [],
      ranked: [],
      selected: [],
      primaryClustering: {
        ...PRIMARY_CLUSTERING,
        clusters: 0
      },
      fallbackClustering: void 0,
      pathFlags: {
        usedFallbackClustering: false,
        usedSyntheticFallback: false,
        usedPromotedReject: false
      },
      stageNotes
    }) : void 0;
    return {
      location,
      retrieval: {
        mode: "none",
        city: location.meta.city ?? "",
        curatedCount: 0,
        liveRawFetchedCount: 0,
        liveFetchedCount: 0,
        liveMappedCount: 0,
        liveMappedDroppedCount: 0,
        liveMapDropReasons: {},
        liveNormalizedCount: 0,
        liveNormalizationDroppedCount: 0,
        liveNormalizationDropReasons: {},
        liveAcceptedPreGeoCount: 0,
        liveAcceptedCount: 0,
        liveSuppressedCount: 0,
        liveSuppressionReasons: {},
        geoBucketCount: 0,
        dominantAreaShare: 0,
        geoSpreadScore: 0,
        geoDiversityDownsampledCount: 0,
        bootstrapCount: 0,
        selectedCount: 0,
        notes: [
          location.meta.unresolvedReason ?? "Location query could not be resolved for district retrieval."
        ]
      },
      entities: [],
      rawPockets: [],
      viablePockets: [],
      rejectedPockets: [],
      refinedPockets: [],
      identifiedPockets: [],
      profiles: [],
      ranked: [],
      selected: [],
      meta: {
        version: "district-engine-phase-1-3",
        context: resolvedContext,
        provenance: [
          "location-conditioned-pocket-inference",
          "geo-dbscan",
          "viability-deterministic-rules",
          "typed-debug-trace",
          "location-unresolved"
        ]
      },
      debug: debug2
    };
  }
  const entityFetch = await fetchPlaceEntities({
    resolvedLocation: location,
    maxEntities: input.maxEntities,
    searchRadiusM: input.searchRadiusM
  });
  const entities = entityFetch.entities;
  const primaryRawPockets = formRawPockets({
    entities,
    clustering: PRIMARY_CLUSTERING,
    origin: "primary",
    clusteringSource: "primary",
    stageNotes: ["Primary DBSCAN clustering pass."]
  });
  let rawPockets = primaryRawPockets;
  let viability = applyPocketViabilityRules(rawPockets);
  let fallbackClustering;
  if (viability.accepted.length === 0 && entities.length >= 3) {
    usedFallbackClustering = true;
    stageNotes.push("Fallback reclustering applied after no accepted primary pockets.");
    const fallbackRaw = formRawPockets({
      entities,
      clustering: FALLBACK_CLUSTERING,
      origin: "fallback_recluster",
      clusteringSource: "fallback",
      stageNotes: ["Fallback DBSCAN clustering pass with relaxed min points and radius."]
    });
    const fallbackViability = applyPocketViabilityRules(fallbackRaw);
    fallbackClustering = {
      ...FALLBACK_CLUSTERING,
      clusters: fallbackRaw.length,
      applied: true
    };
    if (fallbackRaw.length > 0) {
      rawPockets = fallbackRaw;
      viability = fallbackViability;
    }
  }
  if (rawPockets.length === 0 && entities.length >= 3) {
    usedSyntheticFallback = true;
    stageNotes.push("Synthetic fallback pocket created because clustering returned no pockets.");
    const synthetic = buildRawPocketFromEntities(
      entities.slice(0, Math.min(8, entities.length)),
      FALLBACK_CLUSTERING,
      {
        pocketId: "raw-pocket-synthetic-1",
        origin: "synthetic_fallback",
        clusteringSource: "synthetic",
        stageNotes: ["Synthetic fallback pocket assembled from nearest entities."]
      }
    );
    rawPockets = [synthetic];
    viability = applyPocketViabilityRules(rawPockets);
    fallbackClustering = {
      ...FALLBACK_CLUSTERING,
      clusters: rawPockets.length,
      applied: true
    };
  }
  if (viability.accepted.length === 0 && entities.length >= 3 && viability.rejected.length > 0) {
    viability = promoteBestReject(viability);
    usedPromotedReject = true;
    stageNotes.push("Promoted best rejected pocket to weak to preserve non-empty output.");
  }
  const refinedPockets = refinePocketsWithSplitMerge(viability.accepted);
  const identifiedPockets = inferPocketIdentity(refinedPockets);
  const profiles = assemblePocketProfiles(identifiedPockets, resolvedContext);
  const ranking = rankAndSelectPockets(profiles);
  const debug = input.includeDebug ? buildDistrictDebugTrace({
    location,
    retrieval: entityFetch.retrieval,
    entityCount: entities.length,
    rawPockets,
    viability,
    refinedPockets,
    identifiedPockets,
    profiles,
    ranked: ranking.ranked,
    selected: ranking.selected,
    primaryClustering: {
      ...PRIMARY_CLUSTERING,
      clusters: primaryRawPockets.length
    },
    fallbackClustering,
    pathFlags: {
      usedFallbackClustering,
      usedSyntheticFallback,
      usedPromotedReject
    },
    stageNotes
  }) : void 0;
  return {
    location,
    retrieval: entityFetch.retrieval,
    entities,
    rawPockets,
    viablePockets: viability.accepted,
    rejectedPockets: viability.rejected,
    refinedPockets,
    identifiedPockets,
    profiles,
    ranked: ranking.ranked,
    selected: ranking.selected,
    meta: {
      version: "district-engine-phase-1-3",
      context: resolvedContext,
      provenance: [
        "location-conditioned-pocket-inference",
        "geo-dbscan",
        "viability-deterministic-rules",
        "typed-debug-trace"
      ]
    },
    debug
  };
}

// tmp/quick_rank_probe.ts
var r = await buildDistrictOpportunityProfiles({ locationQuery: "San Jose", includeDebug: true });
console.log(JSON.stringify(r.ranked.map((e) => ({ pocketId: e.profile.pocketId, label: e.profile.label, score: e.score, rank: e.rank, reasons: e.reasons?.slice(0, 2) })), null, 2));
