const sourceModes = new Set(['curated', 'live', 'hybrid']);
function parseSourceMode(value) {
    if (!value) {
        return undefined;
    }
    return sourceModes.has(value) ? value : undefined;
}
function getProcessEnvValue(key) {
    const processEnv = globalThis
        .process?.env;
    return processEnv?.[key];
}
export function getSourceMode(input) {
    const envMode = parseSourceMode(import.meta.env.VITE_ID8_SOURCE_MODE);
    const params = new URLSearchParams(input?.search ??
        (typeof window !== 'undefined' ? window.location.search : ''));
    const debugMode = input?.debugMode ?? params.get('debug') === '1';
    const queryMode = debugMode ? parseSourceMode(params.get('sourceMode')) : undefined;
    return {
        requestedSourceMode: queryMode ?? envMode ?? 'curated',
        overrideApplied: Boolean(queryMode),
    };
}
export function getGooglePlacesConfig() {
    const env = import.meta.env ?? {};
    return {
        apiKey: env.VITE_GOOGLE_PLACES_API_KEY ?? getProcessEnvValue('VITE_GOOGLE_PLACES_API_KEY'),
        endpoint: env.VITE_GOOGLE_PLACES_ENDPOINT ??
            getProcessEnvValue('VITE_GOOGLE_PLACES_ENDPOINT') ??
            'https://places.googleapis.com/v1/places:searchText',
        languageCode: env.VITE_GOOGLE_PLACES_LANGUAGE_CODE ??
            getProcessEnvValue('VITE_GOOGLE_PLACES_LANGUAGE_CODE') ??
            'en',
        regionCode: env.VITE_GOOGLE_PLACES_REGION_CODE ??
            getProcessEnvValue('VITE_GOOGLE_PLACES_REGION_CODE') ??
            'US',
        pageSize: Number(env.VITE_GOOGLE_PLACES_PAGE_SIZE ??
            getProcessEnvValue('VITE_GOOGLE_PLACES_PAGE_SIZE') ??
            8),
        queryRadiusM: Number(env.VITE_GOOGLE_PLACES_QUERY_RADIUS_M ??
            getProcessEnvValue('VITE_GOOGLE_PLACES_QUERY_RADIUS_M') ??
            3200),
        centerOffsetM: Number(env.VITE_GOOGLE_PLACES_CENTER_OFFSET_M ??
            getProcessEnvValue('VITE_GOOGLE_PLACES_CENTER_OFFSET_M') ??
            2400),
        maxCenters: Number(env.VITE_GOOGLE_PLACES_MAX_CENTERS ??
            getProcessEnvValue('VITE_GOOGLE_PLACES_MAX_CENTERS') ??
            3),
    };
}
export function hasGooglePlacesConfig() {
    return Boolean(getGooglePlacesConfig().apiKey);
}
