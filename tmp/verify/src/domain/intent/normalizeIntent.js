function mapPersonaToCrew(persona, primaryVibe) {
    if (persona === 'romantic') {
        return 'romantic';
    }
    if (persona === 'friends') {
        return 'socialite';
    }
    if (persona === 'family') {
        return 'curator';
    }
    if (primaryVibe === 'cozy' || primaryVibe === 'chill') {
        return 'romantic';
    }
    if (primaryVibe === 'cultured' || primaryVibe === 'adventurous-outdoor') {
        return 'curator';
    }
    return 'socialite';
}
export function normalizeIntent(input) {
    if (!input.primaryVibe) {
        throw new Error('Primary vibe is required before generating a plan.');
    }
    const crew = mapPersonaToCrew(input.persona, input.primaryVibe);
    const refinementModes = Array.from(new Set(input.refinementModes ?? []));
    const secondaryAnchors = input.secondaryVibe ? [input.secondaryVibe] : undefined;
    const normalizedAnchor = input.anchor?.venueId
        ? {
            venueId: input.anchor.venueId,
            role: input.anchor.role ?? 'highlight',
        }
        : undefined;
    const discoveryPreferenceSource = [
        ...(input.discoveryPreferences ?? []),
        ...(normalizedAnchor
            ? [{ venueId: normalizedAnchor.venueId, role: normalizedAnchor.role }]
            : []),
    ];
    const discoveryPreferences = discoveryPreferenceSource.length > 0
        ? Array.from(new Map(discoveryPreferenceSource.map((preference) => [
            preference.venueId,
            preference,
        ])).values())
        : undefined;
    const autoHiddenGemPreference = refinementModes.includes('more-unique') ||
        input.primaryVibe === 'adventurous-urban' ||
        input.mode === 'surprise';
    const planningMode = normalizedAnchor?.venueId ? 'user-led' : input.planningMode ?? 'engine-led';
    return {
        crew,
        persona: input.persona,
        personaSource: input.persona ? 'explicit' : 'derived',
        primaryAnchor: input.primaryVibe,
        secondaryAnchors,
        city: input.city.trim() || 'San Jose',
        district: input.district?.trim() || undefined,
        neighborhood: input.neighborhood?.trim() || undefined,
        distanceMode: input.distanceMode,
        budget: input.budget,
        timeWindow: input.timeWindow ?? input.startTime,
        prefersHiddenGems: input.prefersHiddenGems ?? autoHiddenGemPreference,
        refinementModes,
        mode: input.mode ?? 'build',
        planningMode,
        anchor: normalizedAnchor,
        discoveryPreferences,
        selectedDirectionContext: input.selectedDirectionContext,
    };
}
