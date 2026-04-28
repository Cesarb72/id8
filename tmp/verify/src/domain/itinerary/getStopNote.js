export function getStopNote(role, venue, lens) {
    if (role === 'surprise') {
        return venue.isHiddenGem
            ? 'Local pick with lower exposure and high discovery payoff.'
            : 'A curveball stop chosen to add variety.';
    }
    if (role === 'windDown' && venue.energyLevel <= 2) {
        if (lens?.tone === 'intimate') {
            return 'A softer close designed for lingering and a clean landing.';
        }
        return 'A calmer close to end on a polished note.';
    }
    if (role === 'highlight' && venue.category === 'restaurant') {
        return 'Best for lingering and making this the centerpiece.';
    }
    return undefined;
}
