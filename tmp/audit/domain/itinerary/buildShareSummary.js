export function buildShareSummary(itinerary) {
    const stopNames = itinerary.stops.map((stop) => stop.venueName);
    const stopPreview = stopNames.length <= 3
        ? stopNames.join(' -> ')
        : `${stopNames[0]} -> ${stopNames[1]} -> ${stopNames[2]} -> ${stopNames[3]}`;
    return `${itinerary.title} in ${itinerary.city}: ${stopPreview}.`;
}
