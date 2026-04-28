import { scoreLensCompatibility } from './scoreLensCompatibility';
export function applyLensToVenue(venue, intent, lens) {
    return {
        venue,
        lensCompatibility: scoreLensCompatibility(venue, intent, lens),
    };
}
