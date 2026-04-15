function clampUnit(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(1, value));
}
function toTagSet(values) {
    return new Set(values.map((value) => value.toLowerCase()));
}
function hasAnyTag(tagSet, tags) {
    return tags.some((tag) => tagSet.has(tag));
}
function normalizeVibeBand(vibe, experienceContract, contractConstraints) {
    if (vibe === 'cultured' || experienceContract?.coordinationMode === 'narrative') {
        return 'cultured';
    }
    if (vibe === 'cozy' ||
        vibe === 'chill' ||
        experienceContract?.coordinationMode === 'depth' ||
        contractConstraints?.windDownStrictness === 'soft_required') {
        return 'cozy';
    }
    return 'lively';
}
function resolvePersona(intent, experienceContract) {
    if (experienceContract?.persona) {
        return experienceContract.persona;
    }
    if (intent.persona === 'romantic' || intent.persona === 'friends' || intent.persona === 'family') {
        return intent.persona;
    }
    return intent.crew === 'socialite' ? 'friends' : intent.crew === 'curator' ? 'family' : 'romantic';
}
function resolveNarrativeMode(params) {
    const persona = resolvePersona(params.intent, params.experienceContract);
    const vibeBand = normalizeVibeBand(params.experienceContract?.vibe ?? params.intent.primaryAnchor, params.experienceContract, params.contractConstraints);
    if (persona === 'romantic') {
        return vibeBand === 'cozy'
            ? 'romantic_cozy'
            : vibeBand === 'cultured'
                ? 'romantic_cultured'
                : 'romantic_lively';
    }
    if (persona === 'friends') {
        return vibeBand === 'cozy'
            ? 'friends_cozy'
            : vibeBand === 'cultured'
                ? 'friends_cultured'
                : 'friends_lively';
    }
    if (persona === 'family') {
        return vibeBand === 'cozy'
            ? 'family_cozy'
            : vibeBand === 'cultured'
                ? 'family_cultured'
                : 'family_lively';
    }
    return 'adaptive';
}
function resolveRoleNeighbors(itineraryStops, role) {
    if (!itineraryStops || itineraryStops.length === 0) {
        return {};
    }
    const index = itineraryStops.findIndex((stop) => stop.role === role);
    if (index < 0) {
        return {};
    }
    return {
        previousRole: itineraryStops[index - 1]?.role,
        nextRole: itineraryStops[index + 1]?.role,
    };
}
function deriveFlavorTags(params) {
    const { role, stop, scoredVenue, experienceContract, contractConstraints } = params;
    const signals = scoredVenue?.taste.signals;
    const tagSet = toTagSet(stop.tags);
    const flavorScores = new Map();
    const addScore = (label, value) => {
        if (value <= 0) {
            return;
        }
        flavorScores.set(label, (flavorScores.get(label) ?? 0) + value);
    };
    const energy = clampUnit(signals?.energy ?? (hasAnyTag(tagSet, ['quiet', 'cozy']) ? 0.32 : 0.56));
    const socialDensity = clampUnit(signals?.socialDensity ?? (hasAnyTag(tagSet, ['social', 'live', 'cocktails']) ? 0.7 : 0.45));
    const intimacy = clampUnit(signals?.intimacy ?? (hasAnyTag(tagSet, ['intimate', 'cozy']) ? 0.68 : 0.42));
    const linger = clampUnit(signals?.lingerFactor ?? (hasAnyTag(tagSet, ['tasting', 'dessert', 'tea', 'wine']) ? 0.66 : 0.45));
    const destination = clampUnit(signals?.destinationFactor ??
        (hasAnyTag(tagSet, ['chef-led', 'tasting', 'signature']) || role === 'highlight' ? 0.64 : 0.38));
    const experiential = clampUnit(signals?.experientialFactor ??
        (stop.category === 'museum' || stop.category === 'event' || stop.category === 'activity' ? 0.68 : 0.42));
    const momentIntensity = clampUnit(signals?.momentIntensity.score ?? (role === 'highlight' ? 0.72 : 0.48));
    addScore('intimate', intimacy);
    addScore('social', socialDensity);
    addScore('lingering', linger);
    addScore('destination', destination);
    addScore('experiential', experiential);
    addScore('calm', 1 - energy);
    addScore('animated', energy);
    addScore('discovery-led', stop.category === 'museum' || stop.category === 'event' ? 0.82 : signals?.primaryExperienceArchetype === 'culture' ? 0.72 : 0.35);
    addScore('group-friendly', socialDensity * 0.82 + (hasAnyTag(tagSet, ['group', 'shareable']) ? 0.2 : 0));
    addScore('recovery-friendly', (contractConstraints?.requireRecoveryWindows ? 0.3 : 0) + (1 - energy) * 0.66 + linger * 0.24);
    addScore('contained pulse', experienceContract?.coordinationMode === 'pulse' &&
        (experienceContract.movementStyle === 'contained' || contractConstraints?.movementTolerance === 'compressed')
        ? 0.92
        : 0);
    addScore('dual-track', experienceContract?.socialPosture === 'parallel_tracks' ||
        (experienceContract?.persona === 'family' &&
            (stop.category === 'museum' || stop.category === 'park' || hasAnyTag(tagSet, ['family', 'kid', 'play'])))
        ? 0.88
        : 0);
    addScore('clear centerpiece', role === 'highlight'
        ? momentIntensity * 0.72 +
            destination * 0.4 +
            (contractConstraints?.highlightPressure === 'strong' ? 0.2 : 0)
        : 0);
    const ordered = [...flavorScores.entries()]
        .filter((entry) => entry[1] >= 0.54)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map((entry) => entry[0]);
    const unique = Array.from(new Set(ordered));
    if (unique.length === 0) {
        return role === 'highlight' ? ['clear centerpiece'] : role === 'windDown' ? ['recovery-friendly'] : ['low-friction'];
    }
    return unique.slice(0, 3);
}
function resolveRoleMeaning(mode, role) {
    if (role === 'start') {
        if (mode === 'romantic_cozy') {
            return 'Opens with low-friction intimacy so closeness builds without pressure.';
        }
        if (mode === 'romantic_lively') {
            return 'Opens with contained pulse so momentum builds without overwhelming the tone.';
        }
        if (mode === 'friends_lively') {
            return 'Starts as an easy group ignition point with basecamp energy.';
        }
        if (mode === 'family_cultured') {
            return 'Starts with a low-friction discovery anchor everyone can enter quickly.';
        }
        if (mode === 'family_cozy' || mode === 'family_lively') {
            return 'Starts with an easy engagement beat that keeps transitions forgiving.';
        }
        return 'Sets tone cleanly without spending the route too early.';
    }
    if (role === 'highlight') {
        if (mode === 'romantic_cozy') {
            return 'Earned centerpiece with stronger emotional weight and sensory focus.';
        }
        if (mode === 'romantic_lively') {
            return 'Shared pulse centerpiece where the night clearly arrives.';
        }
        if (mode === 'friends_lively') {
            return 'Social peak with the strongest collective moment in the arc.';
        }
        if (mode === 'family_cultured') {
            return 'Primary enrichment anchor with dual-track value for mixed attention.';
        }
        return 'Central anchor the surrounding sequence is built to support.';
    }
    if (role === 'windDown') {
        if (mode === 'romantic_cozy') {
            return 'Soft landing that protects continuity and closeness.';
        }
        if (mode === 'romantic_lively') {
            return 'Controlled taper that settles energy without a dead stop.';
        }
        if (mode === 'friends_lively') {
            return 'Reset landing before the group fully disperses.';
        }
        if (mode === 'family_cultured') {
            return 'Decompression stop for regrouping after the enrichment peak.';
        }
        return 'Intentional close that preserves route coherence.';
    }
    return 'Adds contrast without breaking continuity.';
}
function resolveWhyNow(params) {
    const { mode, role, flavorTags, contractConstraints } = params;
    const flavor = flavorTags.join(', ');
    if (role === 'highlight') {
        if (mode === 'romantic_lively') {
            return `Why now: strongest shared energy with ${flavor || 'social lift'} and a controlled taper path.`;
        }
        if (mode === 'family_cultured') {
            return `Why now: highest enrichment value with ${flavor || 'dual-track support'} before decompression.`;
        }
        if (mode === 'friends_lively') {
            return `Why now: social momentum peaks here with ${flavor || 'crowd-ready energy'}.`;
        }
        return `Why now: clear centerpoint read with ${flavor || 'strong moment potential'}.`;
    }
    if (role === 'windDown') {
        if (contractConstraints?.requireRecoveryWindows) {
            return `Why now: recovery-friendly landing with ${flavor || 'lower-friction pacing'}.`;
        }
        return `Why now: closes the arc cleanly with ${flavor || 'steadier energy'}.`;
    }
    if (mode === 'friends_lively') {
        return `Why now: quick group ignition with ${flavor || 'social carry-forward'}.`;
    }
    return `Why now: sets the route tone through ${flavor || 'coherent pacing'}.`;
}
function resolveTransitionLogic(params) {
    const { role, previousRole, nextRole, contractConstraints } = params;
    if (role === 'start' && nextRole === 'highlight') {
        if (contractConstraints?.requireEscalation) {
            return 'Builds into the center with rising pulse and continuity intact.';
        }
        return 'Builds into the center without forcing the pace too early.';
    }
    if (role === 'highlight' && nextRole === 'windDown') {
        if (contractConstraints?.windDownStrictness === 'soft_required') {
            return 'Hands off to a soft landing after the peak.';
        }
        if (contractConstraints?.windDownStrictness === 'controlled') {
            return 'Carries pulse forward into a controlled taper.';
        }
        return 'Releases the center into a flexible close.';
    }
    if (role === 'windDown' && previousRole === 'highlight') {
        if (contractConstraints?.requireRecoveryWindows) {
            return 'Absorbs the peak and gives the route room to recover.';
        }
        return 'Settles the route after the central moment without losing coherence.';
    }
    if (nextRole === 'highlight') {
        return 'Adds contrast while still feeding the route toward its center.';
    }
    if (previousRole === 'highlight') {
        return 'Carries forward from the center without overextending the arc.';
    }
    return 'Supports sequence continuity between adjacent beats.';
}
export function deriveContractAwareStopNarrative(params) {
    const mode = resolveNarrativeMode({
        intent: params.intent,
        experienceContract: params.experienceContract,
        contractConstraints: params.contractConstraints,
    });
    const { previousRole, nextRole } = resolveRoleNeighbors(params.itineraryStops, params.stop.role);
    const flavorTags = deriveFlavorTags({
        role: params.stop.role,
        stop: params.stop,
        scoredVenue: params.scoredVenue,
        experienceContract: params.experienceContract,
        contractConstraints: params.contractConstraints,
    });
    const roleMeaning = resolveRoleMeaning(mode, params.stop.role);
    const whyNow = resolveWhyNow({
        mode,
        role: params.stop.role,
        flavorTags,
        contractConstraints: params.contractConstraints,
    });
    const transitionLogic = resolveTransitionLogic({
        role: params.stop.role,
        previousRole,
        nextRole,
        contractConstraints: params.contractConstraints,
    });
    return {
        mode,
        source: params.experienceContract && params.contractConstraints ? 'contract_constraints_role_flavor' : 'intent_role_flavor',
        roleMeaning,
        whyNow,
        transitionLogic,
        flavorTags,
        flavorSummary: flavorTags.join(' · '),
        transitionSummary: transitionLogic,
    };
}
