const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;
export function haversineDistanceM(a, b) {
    const lat1 = a.lat * DEG_TO_RAD;
    const lat2 = b.lat * DEG_TO_RAD;
    const deltaLat = (b.lat - a.lat) * DEG_TO_RAD;
    const deltaLng = (b.lng - a.lng) * DEG_TO_RAD;
    const sinDeltaLat = Math.sin(deltaLat / 2);
    const sinDeltaLng = Math.sin(deltaLng / 2);
    const haversineTerm = sinDeltaLat * sinDeltaLat +
        Math.cos(lat1) * Math.cos(lat2) * sinDeltaLng * sinDeltaLng;
    const angularDistance = 2 * Math.atan2(Math.sqrt(haversineTerm), Math.sqrt(1 - haversineTerm));
    return EARTH_RADIUS_M * angularDistance;
}
export function centroidOf(points) {
    if (points.length === 0) {
        return { lat: 0, lng: 0 };
    }
    const sum = points.reduce((accumulator, point) => ({
        lat: accumulator.lat + point.lat,
        lng: accumulator.lng + point.lng,
    }), { lat: 0, lng: 0 });
    return {
        lat: sum.lat / points.length,
        lng: sum.lng / points.length,
    };
}
export function projectToLocalMeters(reference, point) {
    const latDeltaM = (point.lat - reference.lat) * 111320;
    const lngScale = Math.cos(reference.lat * DEG_TO_RAD) * 111320;
    const lngDeltaM = (point.lng - reference.lng) * lngScale;
    return { xM: lngDeltaM, yM: latDeltaM };
}
export function computeBoundingBoxMetrics(points) {
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
        heightM: Math.max(0, maxY - minY),
    };
}
