import { getDurationClass, getDurationProfile } from './getDurationProfile';
function roleAdjustment(role) {
    if (role === 'warmup') {
        return -10;
    }
    if (role === 'peak') {
        return 10;
    }
    if (role === 'wildcard') {
        return 5;
    }
    return -5;
}
export function formatStopDurationLabel(minutes) {
    return `about ${minutes} min`;
}
export function estimateStopDuration(stop) {
    const profile = getDurationProfile(stop.scoredVenue.venue);
    const estimatedDurationMinutes = Math.max(profile.minMinutes, Math.min(profile.maxMinutes, profile.baseMinutes + roleAdjustment(stop.role)));
    return {
        roleKey: stop.role,
        venueId: stop.scoredVenue.venue.id,
        durationClass: getDurationClass(estimatedDurationMinutes),
        estimatedDurationMinutes,
    };
}
