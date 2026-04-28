import { getVibeLabel } from '../types/intent';
function crewLabel(crew) {
    if (crew === 'romantic') {
        return 'Romantic';
    }
    if (crew === 'socialite') {
        return 'Friends';
    }
    return 'Family';
}
export function buildUserReasonLabels({ role, venue, intent, starterPackTitle, starterPackImpact, refinementImpact, fallbackLabel, }) {
    const labels = [];
    const primaryVibe = getVibeLabel(intent.primaryAnchor);
    if (venue.fitBreakdown.anchorFit >= 0.68) {
        labels.push(`Matches ${primaryVibe}`);
    }
    if (venue.fitBreakdown.crewFit >= 0.68) {
        labels.push(`Fits your ${crewLabel(intent.crew)} plan`);
    }
    if (venue.fitBreakdown.proximityFit >= 0.72) {
        labels.push('Closer to your area');
    }
    if (venue.venue.isHiddenGem || venue.hiddenGemScore >= 0.72) {
        labels.push('Hidden gem pick');
    }
    if (role === 'windDown' && venue.venue.energyLevel <= 2) {
        labels.push('Better for a relaxed finish');
    }
    if (starterPackTitle && starterPackImpact.length > 0) {
        labels.push(`From your ${starterPackTitle} starter pack`);
    }
    if (refinementImpact.length > 0) {
        labels.push(refinementImpact[0]);
    }
    if (labels.length === 0) {
        labels.push(fallbackLabel);
    }
    return [...new Set(labels)].slice(0, 4);
}
