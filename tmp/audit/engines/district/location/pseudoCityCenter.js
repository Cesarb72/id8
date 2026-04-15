export function normalizeCityKey(value) {
    const normalized = (value ?? '').trim().toLowerCase().replace(/\./g, '');
    const [head] = normalized.split(',');
    return (head ?? normalized).replace(/\s+/g, ' ').trim();
}
function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function hashToUnit(value) {
    return hashString(value) / 4294967295;
}
export function getPseudoCityCenter(city) {
    const cityKey = normalizeCityKey(city) || 'unknown';
    const lat = 30.5 + hashToUnit(`${cityKey}:lat`) * 11.5;
    const lng = -121.5 + hashToUnit(`${cityKey}:lng`) * 23.5;
    return {
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4)),
    };
}
