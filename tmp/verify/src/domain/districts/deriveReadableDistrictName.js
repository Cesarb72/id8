const DISTRICT_NAMING_OVERRIDES = {
    'san jose': {
        downtown: {
            displayName: 'Downtown San Jose',
            optionalAnchor: 'Around downtown core',
        },
        university: {
            displayName: 'San Jose State Area',
            optionalAnchor: 'Near San Jose State',
        },
        'sjsu area': {
            displayName: 'San Jose State Area',
            optionalAnchor: 'Near San Jose State',
        },
        sofa: {
            displayName: 'SoFA District',
            optionalAnchor: 'South of First',
        },
        'san pedro': {
            displayName: 'San Pedro Square Area',
            optionalAnchor: 'Near downtown core',
        },
        'san pedro square': {
            displayName: 'San Pedro Square Area',
            optionalAnchor: 'Near downtown core',
        },
        'santana row': {
            displayName: 'Santana Row Area',
            optionalAnchor: 'Near Santana Row',
        },
        'santana row / valley fair': {
            displayName: 'Santana Row Area',
            optionalAnchor: 'Near Santana Row',
        },
        midtown: {
            displayName: 'Midtown San Jose',
        },
        'willow glen': {
            displayName: 'Willow Glen Area',
        },
        japantown: {
            displayName: 'Japantown Area',
        },
        evergreen: {
            displayName: 'Evergreen Area',
        },
        'rose garden': {
            displayName: 'Rose Garden Area',
        },
        'the alameda': {
            displayName: 'The Alameda Area',
        },
        'north san jose': {
            displayName: 'North San Jose',
        },
        'kelley park': {
            displayName: 'Kelley Park Area',
        },
    },
    denver: {
        'downtown lodo': {
            displayName: 'Downtown / LoDo',
        },
        'downtown core': {
            displayName: 'Downtown / LoDo',
        },
        rino: {
            displayName: 'RiNo Art District',
        },
        'cherry creek': {
            displayName: 'Cherry Creek',
        },
        'highlands lohi': {
            displayName: 'Highlands / LoHi',
        },
    },
};
function normalizeLabel(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function normalizeCityKey(value) {
    const [head] = value.split(',');
    return normalizeLabel((head ?? value).trim());
}
function toTitleCase(value) {
    return value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}
function withAreaSuffix(value) {
    if (/\b(area|district|square|row)\b/i.test(value)) {
        return value;
    }
    return `${value} Area`;
}
function buildGenericDisplayName(rawDistrict, city) {
    const cleanDistrict = toTitleCase(rawDistrict);
    const normalizedDistrict = normalizeLabel(rawDistrict);
    const cleanCity = (city.split(',')[0] ?? city).trim() || 'San Jose';
    if (normalizedDistrict === 'downtown') {
        return `Downtown ${cleanCity}`;
    }
    if (normalizedDistrict === 'midtown') {
        return `Midtown ${cleanCity}`;
    }
    if (normalizedDistrict === 'university') {
        return cleanCity.toLowerCase() === 'san jose'
            ? 'San Jose State Area'
            : `${cleanCity} University Area`;
    }
    return withAreaSuffix(cleanDistrict);
}
export function deriveReadableDistrictName(district, cityContext) {
    const city = cityContext.city.trim() || 'San Jose';
    const normalizedCity = normalizeLabel(city);
    const normalizedCityKey = normalizeCityKey(city);
    const normalizedDistrict = normalizeLabel(district);
    const cityOverrides = DISTRICT_NAMING_OVERRIDES[normalizedCity] ??
        DISTRICT_NAMING_OVERRIDES[normalizedCityKey] ??
        {};
    const override = cityOverrides[normalizedDistrict];
    if (override) {
        return override;
    }
    return {
        displayName: buildGenericDisplayName(district, city),
    };
}
