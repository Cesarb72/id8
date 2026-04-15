function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function normalizeValue(value) {
    return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}
function hasAny(values, candidates) {
    return candidates.some((candidate) => values.includes(candidate));
}
function toWeeklyMinute(day, hour, minute) {
    return day * 24 * 60 + hour * 60 + minute;
}
function mapBusinessStatus(value) {
    const normalized = value ? normalizeValue(value) : 'unknown';
    if (normalized === 'operational') {
        return 'operational';
    }
    if (normalized === 'closed-temporarily' || normalized === 'temporarily-closed') {
        return 'temporarily-closed';
    }
    if (normalized === 'closed-permanently') {
        return 'closed-permanently';
    }
    return 'unknown';
}
function isOpenDuringWindow(periods, signal) {
    if (!periods || periods.length === 0) {
        return undefined;
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
        ...(raw.placeTypes ?? []),
        ...(raw.sourceTypes ?? []),
        ...(raw.tags ?? []),
    ].map(normalizeValue);
    if (category === 'cafe') {
        if (signal.phase === 'morning') {
            return { likelyOpen: true, confidence: 0.58, notes: ['cafe-hour heuristic favors mornings'] };
        }
        if (signal.phase === 'afternoon') {
            return { likelyOpen: true, confidence: 0.54, notes: ['cafe-hour heuristic still supports afternoons'] };
        }
        if (signal.phase === 'evening') {
            const eveningCafe = hasAny(placeSignals, ['dessert', 'tea-house', 'intimate', 'late-night']);
            return {
                likelyOpen: eveningCafe,
                confidence: eveningCafe ? 0.46 : 0.5,
                notes: [eveningCafe ? 'evening cafe signal detected' : 'cafe-hour heuristic weak after daytime'],
            };
        }
        return {
            likelyOpen: hasAny(placeSignals, ['late-night', 'dessert']),
            confidence: hasAny(placeSignals, ['late-night', 'dessert']) ? 0.56 : 0.58,
            notes: ['late-night cafe heuristic is conservative'],
        };
    }
    if (category === 'bar') {
        if (signal.phase === 'morning') {
            return { likelyOpen: false, confidence: 0.78, notes: ['bar-hour heuristic suppresses morning anchors'] };
        }
        if (signal.phase === 'afternoon') {
            const afternoonBar = hasAny(placeSignals, ['brewery', 'sports-bar', 'beer-hall']);
            return {
                likelyOpen: afternoonBar,
                confidence: afternoonBar ? 0.52 : 0.56,
                notes: [afternoonBar ? 'afternoon bar subtype detected' : 'bar-hour heuristic prefers later windows'],
            };
        }
        return {
            likelyOpen: true,
            confidence: signal.phase === 'late-night' ? 0.66 : 0.6,
            notes: ['bar-hour heuristic supports evening nightlife windows'],
        };
    }
    if (signal.phase === 'morning') {
        const brunchFriendly = hasAny(placeSignals, ['breakfast', 'brunch', 'coffee']);
        return {
            likelyOpen: brunchFriendly,
            confidence: brunchFriendly ? 0.56 : 0.5,
            notes: [brunchFriendly ? 'morning restaurant subtype detected' : 'restaurant-hour heuristic is weaker in the morning'],
        };
    }
    if (signal.phase === 'late-night') {
        const lateNightFriendly = hasAny(placeSignals, ['late-night', 'cocktails', 'bar']);
        return {
            likelyOpen: lateNightFriendly,
            confidence: lateNightFriendly ? 0.52 : 0.52,
            notes: [lateNightFriendly ? 'late-night restaurant signal detected' : 'restaurant-hour heuristic softens after late night'],
        };
    }
    notes.push(signal.phase === 'evening' ? 'restaurant-hour heuristic favors dinner windows' : 'restaurant-hour heuristic supports daytime service');
    return {
        likelyOpen: true,
        confidence: signal.phase === 'evening' ? 0.58 : 0.54,
        notes,
    };
}
export function inferHoursPressure({ raw, category, timeWindowSignal, }) {
    const businessStatus = mapBusinessStatus(raw.businessStatus);
    const isLive = raw.sourceOrigin === 'live';
    if (!isLive) {
        return {
            openNow: undefined,
            hoursKnown: false,
            likelyOpenForCurrentWindow: true,
            businessStatus,
            timeConfidence: 0.24,
            hoursPressureLevel: 'unknown',
            hoursPressureNotes: ['Curated venue has no live hours metadata in this phase.'],
        };
    }
    if (businessStatus === 'closed-permanently' || businessStatus === 'temporarily-closed') {
        return {
            openNow: false,
            hoursKnown: true,
            likelyOpenForCurrentWindow: false,
            businessStatus,
            timeConfidence: 1,
            hoursPressureLevel: 'closed',
            hoursPressureNotes: [`Business status is ${businessStatus}.`],
        };
    }
    const hoursKnown = Boolean(typeof raw.openNow === 'boolean' ||
        (raw.hoursPeriods && raw.hoursPeriods.length > 0) ||
        (raw.currentOpeningHoursText && raw.currentOpeningHoursText.length > 0) ||
        (raw.regularOpeningHoursText && raw.regularOpeningHoursText.length > 0));
    if (typeof raw.openNow === 'boolean') {
        if (timeWindowSignal?.usesIntentWindow) {
            const heuristic = inferLikelyOpenFromCategory(raw, category, timeWindowSignal);
            const confidence = clamp01(heuristic.confidence +
                (raw.openNow ? 0.1 : -0.02) +
                ((raw.hoursPeriods?.length ?? 0) > 0 ? 0.06 : 0));
            return {
                openNow: raw.openNow,
                hoursKnown: true,
                likelyOpenForCurrentWindow: heuristic.likelyOpen,
                businessStatus,
                timeConfidence: Number(confidence.toFixed(2)),
                hoursPressureLevel: heuristic.likelyOpen ? 'likely-open' : 'likely-closed',
                hoursPressureNotes: [
                    ...heuristic.notes,
                    raw.openNow
                        ? 'Provider reports open now, but a future/planned window required heuristic calibration.'
                        : 'Provider reports closed now, but the requested planning window required softer heuristic calibration.',
                ],
            };
        }
        return {
            openNow: raw.openNow,
            hoursKnown: true,
            likelyOpenForCurrentWindow: raw.openNow,
            businessStatus,
            timeConfidence: raw.openNow ? 0.96 : 0.94,
            hoursPressureLevel: raw.openNow ? 'strong-open' : 'closed',
            hoursPressureNotes: [raw.openNow ? 'Provider reports open now.' : 'Provider reports closed now.'],
        };
    }
    if (timeWindowSignal && raw.hoursPeriods && raw.hoursPeriods.length > 0) {
        const openFromPeriods = isOpenDuringWindow(raw.hoursPeriods, timeWindowSignal);
        if (typeof openFromPeriods === 'boolean') {
            return {
                openNow: undefined,
                hoursKnown: true,
                likelyOpenForCurrentWindow: openFromPeriods,
                businessStatus,
                timeConfidence: 0.88,
                hoursPressureLevel: openFromPeriods ? 'strong-open' : 'likely-closed',
                hoursPressureNotes: [
                    openFromPeriods
                        ? `Opening periods suggest the venue is available for ${timeWindowSignal.label}.`
                        : `Opening periods suggest the venue is not available for ${timeWindowSignal.label}.`,
                ],
            };
        }
    }
    if (!timeWindowSignal) {
        return {
            openNow: undefined,
            hoursKnown,
            likelyOpenForCurrentWindow: true,
            businessStatus,
            timeConfidence: hoursKnown ? 0.56 : 0.38,
            hoursPressureLevel: hoursKnown ? 'likely-open' : 'unknown',
            hoursPressureNotes: [
                hoursKnown
                    ? 'Hours metadata exists, but no current planning window was available.'
                    : 'No hours metadata was available from the live provider.',
            ],
        };
    }
    const heuristic = inferLikelyOpenFromCategory(raw, category, timeWindowSignal);
    const softenedConfidence = clamp01(heuristic.confidence +
        (hoursKnown ? 0.04 : heuristic.likelyOpen ? 0.02 : -0.08));
    return {
        openNow: undefined,
        hoursKnown,
        likelyOpenForCurrentWindow: heuristic.likelyOpen,
        businessStatus,
        timeConfidence: Number(softenedConfidence.toFixed(2)),
        hoursPressureLevel: !hoursKnown
            ? heuristic.likelyOpen || softenedConfidence < 0.64
                ? 'unknown'
                : 'likely-closed'
            : heuristic.likelyOpen
                ? 'likely-open'
                : 'likely-closed',
        hoursPressureNotes: [
            ...heuristic.notes,
            hoursKnown
                ? `Hours metadata exists but required heuristic interpretation for ${timeWindowSignal.label}.`
                : `No structured hours were returned, so a ${timeWindowSignal.label} heuristic was used.`,
        ],
    };
}
