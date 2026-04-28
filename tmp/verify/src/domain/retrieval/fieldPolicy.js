const DEFAULT_FIELD_POLICY = {
    authorityTargets: [],
    sourceMode: {
        autoUpgradeCuratedToHybrid: false,
        allowCuratedFallbackWithoutCoverage: false,
        allowDefaultCityFallbackWhenNoExactMatch: false,
        defaultFallbackCity: 'san jose',
    },
};
const FIELD_POLICY_BY_CITY = {
    'san jose': {
        authorityTargets: [
            'La Foret',
            'Hakone Gardens',
            'Hedley Club Lounge',
            'Japanese Friendship Garden',
            'Friendship Garden',
            'Willow Glen',
            'Hammer Theatre',
            'Opera San Jose',
            'San Pedro Square Market',
            'SAP Center',
        ],
        sourceMode: {
            autoUpgradeCuratedToHybrid: true,
            allowCuratedFallbackWithoutCoverage: true,
            allowDefaultCityFallbackWhenNoExactMatch: true,
            defaultFallbackCity: 'san jose',
        },
    },
};
function sanitize(value) {
    return value.trim().toLowerCase();
}
export function sanitizeCityKey(value) {
    const normalized = sanitize(value).replace(/\./g, '');
    const [head] = normalized.split(',');
    return (head ?? normalized).trim();
}
function resolveFieldCityRetrievalPolicy(cityQuery) {
    const cityPolicy = FIELD_POLICY_BY_CITY[cityQuery] ?? {};
    return {
        authorityTargets: cityPolicy.authorityTargets ?? DEFAULT_FIELD_POLICY.authorityTargets,
        sourceMode: {
            ...DEFAULT_FIELD_POLICY.sourceMode,
            ...(cityPolicy.sourceMode ?? {}),
        },
    };
}
export function resolveFieldRetrievalSourceMode(params) {
    const policy = resolveFieldCityRetrievalPolicy(params.cityQuery);
    if (params.requestedSourceMode === 'curated' &&
        !params.sourceModeOverrideApplied &&
        policy.sourceMode.autoUpgradeCuratedToHybrid) {
        return 'hybrid';
    }
    return params.requestedSourceMode;
}
export function resolveAllowCuratedFallback(params) {
    const policy = resolveFieldCityRetrievalPolicy(params.cityQuery);
    return (params.curatedCoverageForCity ||
        params.cityQuery.length === 0 ||
        policy.sourceMode.allowCuratedFallbackWithoutCoverage);
}
export function resolveDefaultCityFallback(params) {
    const policy = resolveFieldCityRetrievalPolicy(params.cityQuery);
    const canUseFallbackCity = params.cityQuery.length === 0 || policy.sourceMode.allowDefaultCityFallbackWhenNoExactMatch;
    if (!canUseFallbackCity) {
        return undefined;
    }
    if (!(params.shouldFallbackToCurated || params.retrievalSourceMode === 'curated')) {
        return undefined;
    }
    return policy.sourceMode.defaultFallbackCity;
}
export function getFieldAuthorityTargets(cityQuery) {
    return resolveFieldCityRetrievalPolicy(cityQuery).authorityTargets;
}
