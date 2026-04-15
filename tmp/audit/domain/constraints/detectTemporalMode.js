function normalizeTimeWindow(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
export function detectTemporalMode(input) {
    return normalizeTimeWindow(input?.timeWindow) ? 'explicit' : 'unspecified';
}
export function buildTemporalTrace(input) {
    const rawValue = normalizeTimeWindow(input?.timeWindow);
    if (rawValue) {
        return {
            mode: 'explicit',
            source: 'time_window',
            rawValue,
        };
    }
    return {
        mode: 'unspecified',
        source: 'none',
    };
}
