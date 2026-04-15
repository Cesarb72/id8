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

// src/domain/normalize/inferHoursPressure.ts
function clamp013(value) {
  return Math.max(0, Math.min(1, value));
}
function normalizeValue2(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function hasAny(values, candidates) {
  return candidates.some((candidate) => values.includes(candidate));
}
function toWeeklyMinute(day, hour, minute) {
  return day * 24 * 60 + hour * 60 + minute;
}
function mapBusinessStatus(value) {
  const normalized = value ? normalizeValue2(value) : "unknown";
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
  ].map(normalizeValue2);
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
      const confidence = clamp013(
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
  const softenedConfidence = clamp013(
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

// src/domain/normalize/getNormalizedCategory.ts
function normalizeValue3(value) {
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
  ].map(normalizeValue3);
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
function clamp014(value) {
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
  const strength = clamp014(
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
function clamp(value, min, max) {
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
  return clamp(energy, 1, 5);
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
  return clamp(Math.round(socialDensity), 1, 5);
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
    genericScore: clamp(Number(genericScore.toFixed(2)), 0, 1),
    signatureScore: clamp(Number(signatureScore.toFixed(2)), 0, 1)
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
  const base = clamp(0.58 + signatureScore * 0.24, 0.45, 0.92);
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
    clamp(0.52 + signature.signatureScore * 0.38, 0.4, 0.95),
    inferredFields,
    "uniquenessScore"
  );
  const distinctivenessScore = inferScore(
    raw.distinctivenessScore,
    clamp(0.5 + signature.signatureScore * 0.42, 0.38, 0.96),
    inferredFields,
    "distinctivenessScore"
  );
  const underexposureScore = inferScore(
    raw.underexposureScore,
    clamp(0.42 + (raw.isHiddenGem ? 0.22 : 0) + (signature.signatureScore - signature.genericScore) * 0.12, 0.25, 0.92),
    inferredFields,
    "underexposureScore"
  );
  const shareabilityScore = inferScore(
    raw.shareabilityScore,
    clamp(0.48 + socialDensity * 0.06 + signature.signatureScore * 0.12, 0.35, 0.94),
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
function clamp015(value) {
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
  const completenessScore = clamp015(1 - missingFields.length * 0.1);
  const sourceConfidence = clamp015(
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
      hoursSuppressionApplied: qualityGate.hoursSuppressionApplied
    }
  };
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
function hasGooglePlacesConfig() {
  return Boolean(getGooglePlacesConfig().apiKey);
}

// src/domain/normalize/normalizeVenue.ts
function clamp016(value) {
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
  const completenessScore = clamp016(1 - missingFields.length * 0.11);
  const sourceConfidence = clamp016(
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
      hoursSuppressionApplied: qualityGate.hoursSuppressionApplied
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

// src/domain/search/searchAnchorVenues.ts
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
function normalizeValue5(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
function normalizeCity(value) {
  const normalized = value.trim().toLowerCase().replace(/\./g, "");
  const [head] = normalized.split(",");
  return (head ?? normalized).trim();
}
function unique(values) {
  return [...new Set(values)];
}
function hasAny2(values, candidates) {
  return candidates.some((candidate) => values.includes(candidate));
}
function getNormalizedTypes(place) {
  return unique(
    [place.primaryType, ...place.types ?? []].filter((value) => Boolean(value)).map(normalizeValue5).filter(
      (value) => !["food", "establishment", "point-of-interest", "store", "tourist-attraction"].includes(
        value
      )
    )
  );
}
function resolveAnchorCategory(placeTypes, chip) {
  if (hasAny2(placeTypes, ["bar", "cocktail-bar", "wine-bar", "pub", "brewery", "sports-bar"])) {
    return "bar";
  }
  if (hasAny2(placeTypes, ["cafe", "coffee-shop", "tea-house", "espresso-bar"])) {
    return "cafe";
  }
  if (hasAny2(placeTypes, ["restaurant", "brunch-restaurant", "fine-dining-restaurant"]) || placeTypes.some((type) => type.endsWith("-restaurant"))) {
    return "restaurant";
  }
  if (hasAny2(placeTypes, ["park", "national-park", "dog-park", "garden", "playground"])) {
    return "park";
  }
  if (hasAny2(placeTypes, ["museum", "art-gallery"])) {
    return "museum";
  }
  if (hasAny2(placeTypes, ["concert-hall", "event-venue", "amphitheater"])) {
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
  if (chip === "drinks") {
    return "bar";
  }
  if (chip === "park") {
    return "park";
  }
  if (chip === "movie" || chip === "activity") {
    return "activity";
  }
  return "restaurant";
}
function mapChipToQueryHint(chip) {
  if (chip === "restaurant") {
    return "restaurant";
  }
  if (chip === "movie") {
    return "movie theater";
  }
  if (chip === "drinks") {
    return "cocktail bar";
  }
  if (chip === "park") {
    return "park";
  }
  if (chip === "activity") {
    return "activity";
  }
  return void 0;
}
function buildTextQuery(query, city, neighborhood, chip) {
  const locationLabel = neighborhood ? `${neighborhood}, ${city}` : city;
  const hint = mapChipToQueryHint(chip);
  return hint ? `${query} ${hint} in ${locationLabel}` : `${query} in ${locationLabel}`;
}
function getAddressComponent(components, candidates) {
  return components?.find(
    (component) => component.types?.some((type) => candidates.includes(normalizeValue5(type)))
  )?.longText;
}
function inferCity(place, fallback) {
  return getAddressComponent(place.addressComponents, ["locality"]) ?? getAddressComponent(place.addressComponents, ["administrative-area-level-2"]) ?? fallback;
}
function inferNeighborhood(place, fallback) {
  return getAddressComponent(place.addressComponents, ["neighborhood"]) ?? getAddressComponent(place.addressComponents, ["sublocality-level-1", "sublocality"]) ?? place.shortFormattedAddress?.split(",")[0]?.trim() ?? fallback;
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
function mapGooglePlaceToVenue(place, city, neighborhood, chip) {
  const name = place.displayName?.text?.trim();
  const placeId = place.id?.trim();
  if (!name || !placeId) {
    return void 0;
  }
  const placeTypes = getNormalizedTypes(place);
  const category = resolveAnchorCategory(placeTypes, chip);
  const rawPlace = {
    rawType: "place",
    id: `live_google_${placeId}`,
    name,
    city: inferCity(place, city),
    neighborhood: inferNeighborhood(place, neighborhood) ?? city,
    driveMinutes: neighborhood ? 10 : 12,
    priceTier: mapPriceTier(place.priceLevel),
    tags: unique([
      ...placeTypes,
      ...chip ? [chip] : [],
      ...place.editorialSummary?.text?.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4).slice(0, 5) ?? []
    ]).slice(0, 12),
    shortDescription: place.editorialSummary?.text?.trim() ?? `${name} was selected as a user-led plan anchor.`,
    narrativeFlavor: `${name} is the chosen anchor for a user-led outing.`,
    imageUrl: "",
    categoryHint: category,
    subcategoryHint: placeTypes[0] ?? category,
    placeTypes,
    sourceTypes: placeTypes,
    normalizedFromRawType: "raw-place",
    sourceOrigin: "live",
    provider: "google-places",
    providerRecordId: placeId,
    sourceQueryLabel: "anchor-search",
    queryTerms: chip ? [chip] : void 0,
    sourceConfidence: 0.88,
    formattedAddress: place.formattedAddress,
    rating: place.rating,
    ratingCount: place.userRatingCount,
    openNow: place.currentOpeningHours?.openNow,
    businessStatus: place.businessStatus,
    hoursPeriods: void 0,
    currentOpeningHoursText: place.currentOpeningHours?.weekdayDescriptions,
    regularOpeningHoursText: place.regularOpeningHours?.weekdayDescriptions,
    utcOffsetMinutes: place.utcOffsetMinutes,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude
  };
  return normalizeRawPlace(rawPlace);
}
async function searchGooglePlaces(query, city, neighborhood, chip) {
  const config = getGooglePlacesConfig();
  if (!config.apiKey) {
    return [];
  }
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.apiKey,
      "X-Goog-FieldMask": googleFieldMask
    },
    body: JSON.stringify({
      textQuery: buildTextQuery(query, city, neighborhood, chip),
      pageSize: Math.min(config.pageSize, 6),
      languageCode: config.languageCode,
      regionCode: config.regionCode,
      rankPreference: "RELEVANCE"
    })
  });
  if (!response.ok) {
    throw new Error(`Anchor search failed (${response.status})`);
  }
  const payload = await response.json();
  return (payload.places ?? []).map((place) => {
    const venue = mapGooglePlaceToVenue(place, city, neighborhood, chip);
    if (!venue) {
      return void 0;
    }
    return {
      venue,
      subtitle: place.shortFormattedAddress ?? place.formattedAddress ?? venue.neighborhood
    };
  }).filter((value) => Boolean(value));
}
function scoreFallbackVenue(venue, query, chip) {
  const normalizedQuery = query.trim().toLowerCase();
  const haystack = [
    venue.name,
    venue.category,
    venue.subcategory,
    venue.shortDescription,
    ...venue.tags
  ].join(" ").toLowerCase();
  const nameMatch = venue.name.toLowerCase().includes(normalizedQuery) ? 4 : 0;
  const textMatch = haystack.includes(normalizedQuery) ? 2 : 0;
  const chipMatch = chip === "drinks" ? venue.category === "bar" : chip === "restaurant" ? venue.category === "restaurant" : chip === "park" ? venue.category === "park" : chip === "movie" || chip === "activity" ? venue.category === "activity" || venue.category === "event" || venue.category === "museum" : false;
  return nameMatch + textMatch + (chipMatch ? 1 : 0);
}
function searchFallbackVenues(query, city, neighborhood, chip) {
  return curatedVenues.filter((venue) => normalizeCity(venue.city) === normalizeCity(city)).filter((venue) => !neighborhood || venue.neighborhood.toLowerCase().includes(neighborhood.toLowerCase())).map((venue) => ({
    venue,
    score: scoreFallbackVenue(venue, query, chip),
    subtitle: `${venue.neighborhood} \xB7 ${venue.category.replace("_", " ")}`
  })).filter((result) => result.score > 0).sort((left, right) => right.score - left.score || left.venue.driveMinutes - right.venue.driveMinutes).slice(0, 6).map(({ venue, subtitle }) => ({ venue, subtitle }));
}
async function searchAnchorVenues(input) {
  const trimmedQuery = input.query.trim();
  if (trimmedQuery.length < 2) {
    return [];
  }
  if (!hasGooglePlacesConfig()) {
    return searchFallbackVenues(trimmedQuery, input.city, input.neighborhood, input.chip);
  }
  try {
    const googleResults = await searchGooglePlaces(
      trimmedQuery,
      input.city,
      input.neighborhood,
      input.chip
    );
    if (googleResults.length > 0) {
      return googleResults;
    }
  } catch (error) {
    console.error(error);
  }
  return searchFallbackVenues(trimmedQuery, input.city, input.neighborhood, input.chip);
}

// tmp/anchor-search-audit.ts
var results = await searchAnchorVenues({ query: "Theatre District Jazz Cellar", city: "San Jose" });
console.log(JSON.stringify(results.map((r) => ({ id: r.venue.id, name: r.venue.name, provider: r.venue.source.providerRecordId ?? null, lat: r.venue.source.latitude ?? null, lng: r.venue.source.longitude ?? null })), null, 2));
