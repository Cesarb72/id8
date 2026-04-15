import { resolveHospitalityContract } from '../contracts/resolveHospitalityContract';
import { getRoleShapeForVibe, getVibeProfile } from '../taste/getVibeProfile';
import { applyTasteModeToLens, selectTasteMode } from '../taste/selectTasteMode';
function unique(values) {
    return [...new Set(values)];
}
function toEnergyBand(value) {
    if (value <= 2) {
        return 'low';
    }
    if (value <= 3) {
        return 'medium';
    }
    return 'high';
}
function biasRank(value) {
    if (value === 'low') {
        return 0;
    }
    if (value === 'medium') {
        return 1;
    }
    return 2;
}
function chooseStrongerBias(current, next) {
    return biasRank(next) > biasRank(current) ? next : current;
}
function mergeStopShape(base, patch) {
    return {
        preferredCategories: unique([
            ...(base.preferredCategories ?? []),
            ...(patch.preferredCategories ?? []),
        ]),
        discouragedCategories: unique([
            ...(base.discouragedCategories ?? []),
            ...(patch.discouragedCategories ?? []),
        ]),
        preferredTags: unique([...(base.preferredTags ?? []), ...(patch.preferredTags ?? [])]),
        discouragedTags: unique([
            ...(base.discouragedTags ?? []),
            ...(patch.discouragedTags ?? []),
        ]),
        energyPreference: unique([
            ...(base.energyPreference ?? []),
            ...(patch.energyPreference ?? []),
        ]),
    };
}
function buildNeutralBaseline() {
    return {
        tone: 'refined',
        energyBand: ['low', 'medium'],
        discoveryBias: 'medium',
        movementTolerance: 'medium',
        repetitionTolerance: 'medium',
        wildcardAggressiveness: 0.42,
        preferredCategories: ['museum', 'park', 'cafe', 'dessert', 'activity', 'restaurant', 'bar'],
        discouragedCategories: [],
        preferredTags: ['hands-on', 'walkable', 'local', 'curated'],
        discouragedTags: ['chaotic'],
        windDownExpectation: {
            preferredCategories: ['park', 'dessert', 'cafe', 'museum'],
            discouragedCategories: ['activity', 'live_music'],
            closeToBase: false,
            maxEnergy: 'medium',
        },
        preferredStopShapes: {
            start: {
                preferredCategories: ['park', 'cafe', 'museum'],
                discouragedCategories: [],
                preferredTags: ['walkable', 'easygoing', 'hands-on'],
                discouragedTags: ['high-energy'],
                energyPreference: ['low', 'medium'],
            },
            highlight: {
                preferredCategories: ['museum', 'activity', 'restaurant', 'event'],
                discouragedCategories: [],
                preferredTags: ['immersive', 'story', 'interactive'],
                discouragedTags: ['late-night'],
                energyPreference: ['medium'],
            },
            surprise: {
                preferredCategories: ['event', 'dessert', 'activity', 'park'],
                discouragedCategories: [],
                preferredTags: ['community', 'underexposed', 'local'],
                discouragedTags: ['chaotic'],
                energyPreference: ['low', 'medium'],
            },
            windDown: {
                preferredCategories: ['park', 'dessert', 'cafe'],
                discouragedCategories: ['activity', 'live_music'],
                preferredTags: ['calm', 'accessible', 'easygoing'],
                discouragedTags: ['high-energy', 'crowded'],
                energyPreference: ['low'],
            },
        },
    };
}
function applyVibeShaping(lens, intent) {
    const anchors = [intent.primaryAnchor, ...(intent.secondaryAnchors ?? [])];
    const next = {
        ...lens,
        preferredCategories: [...lens.preferredCategories],
        discouragedCategories: [...lens.discouragedCategories],
        preferredTags: [...lens.preferredTags],
        discouragedTags: [...lens.discouragedTags],
        preferredStopShapes: { ...lens.preferredStopShapes },
        windDownExpectation: { ...lens.windDownExpectation },
    };
    for (const [index, anchor] of anchors.entries()) {
        const profile = getVibeProfile(anchor);
        next.preferredCategories = unique([
            ...next.preferredCategories,
            ...profile.preferredCategories,
        ]);
        next.discouragedCategories = unique([
            ...next.discouragedCategories,
            ...profile.discouragedCategories,
        ]);
        next.preferredTags = unique([...next.preferredTags, ...profile.preferredTags]);
        next.discouragedTags = unique([...next.discouragedTags, ...profile.discouragedTags]);
        next.energyBand = unique([...next.energyBand, ...profile.energyBand]);
        next.discoveryBias = chooseStrongerBias(next.discoveryBias, profile.discoveryBias);
        if (index === 0) {
            next.tone = profile.toneBias;
            next.movementTolerance = profile.movementTolerance;
        }
        else if (biasRank(profile.movementTolerance) > biasRank(next.movementTolerance)) {
            next.movementTolerance = profile.movementTolerance;
        }
        next.preferredStopShapes.start = mergeStopShape(next.preferredStopShapes.start, getRoleShapeForVibe(anchor, 'start'));
        next.preferredStopShapes.highlight = mergeStopShape(next.preferredStopShapes.highlight, getRoleShapeForVibe(anchor, 'highlight'));
        next.preferredStopShapes.surprise = mergeStopShape(next.preferredStopShapes.surprise, getRoleShapeForVibe(anchor, 'surprise'));
        next.preferredStopShapes.windDown = mergeStopShape(next.preferredStopShapes.windDown, getRoleShapeForVibe(anchor, 'windDown'));
        next.windDownExpectation.preferredCategories = unique([
            ...next.windDownExpectation.preferredCategories,
            ...profile.windDown.preferredCategories,
        ]);
        next.windDownExpectation.discouragedCategories = unique([
            ...next.windDownExpectation.discouragedCategories,
            ...profile.windDown.discouragedCategories,
        ]);
        next.windDownExpectation.maxEnergy =
            profile.windDown.energyPreference.includes('low')
                ? 'low'
                : chooseStrongerBias(next.windDownExpectation.maxEnergy, 'medium');
        if (profile.movementTolerance === 'low') {
            next.windDownExpectation.closeToBase = true;
        }
    }
    if (intent.primaryAnchor === 'adventurous-outdoor') {
        next.movementTolerance = next.movementTolerance === 'low' ? 'medium' : next.movementTolerance;
        next.preferredCategories = unique([...next.preferredCategories, 'park', 'cafe', 'dessert']);
        next.discouragedCategories = unique([...next.discouragedCategories, 'museum', 'live_music']);
        next.preferredTags = unique([
            ...next.preferredTags,
            'trail',
            'viewpoint',
            'garden',
            'stargazing',
            'outdoor-seating',
        ]);
        next.discouragedTags = unique([
            ...next.discouragedTags,
            'district',
            'street-food',
            'night-market',
        ]);
        next.windDownExpectation.preferredCategories = unique([
            ...next.windDownExpectation.preferredCategories,
            'park',
            'dessert',
            'cafe',
        ]);
    }
    if (intent.primaryAnchor === 'adventurous-urban') {
        next.discoveryBias = 'high';
        next.movementTolerance = 'high';
        next.preferredCategories = unique([
            ...next.preferredCategories,
            'restaurant',
            'bar',
            'event',
            'dessert',
        ]);
        next.discouragedCategories = unique([...next.discouragedCategories, 'park']);
        next.preferredTags = unique([
            ...next.preferredTags,
            'district',
            'street-food',
            'market',
            'food-hall',
            'neighborhood',
        ]);
        next.discouragedTags = unique([...next.discouragedTags, 'nature', 'trail', 'viewpoint']);
        next.windDownExpectation.closeToBase = false;
    }
    if (intent.primaryAnchor === 'cozy' || intent.primaryAnchor === 'chill') {
        next.movementTolerance = 'low';
        next.windDownExpectation.closeToBase = true;
    }
    if (intent.primaryAnchor === 'lively') {
        next.movementTolerance = 'high';
        next.windDownExpectation.closeToBase = false;
    }
    return next;
}
function applyResolvedContractShaping(lens, resolvedContract) {
    const next = {
        ...lens,
        energyBand: [...lens.energyBand],
        preferredCategories: [...lens.preferredCategories],
        discouragedCategories: [...lens.discouragedCategories],
        preferredTags: [...lens.preferredTags],
        discouragedTags: [...lens.discouragedTags],
        preferredStopShapes: { ...lens.preferredStopShapes },
        windDownExpectation: { ...lens.windDownExpectation },
    };
    if (resolvedContract.toneOverride) {
        next.tone = resolvedContract.toneOverride;
    }
    if (resolvedContract.movementToleranceOverride) {
        next.movementTolerance = resolvedContract.movementToleranceOverride;
    }
    if (resolvedContract.movementToleranceCap) {
        if (biasRank(next.movementTolerance) > biasRank(resolvedContract.movementToleranceCap)) {
            next.movementTolerance = resolvedContract.movementToleranceCap;
        }
    }
    if (resolvedContract.repetitionToleranceOverride) {
        next.repetitionTolerance = resolvedContract.repetitionToleranceOverride;
    }
    if (typeof resolvedContract.wildcardAggressivenessMin === 'number') {
        next.wildcardAggressiveness = Math.max(next.wildcardAggressiveness, resolvedContract.wildcardAggressivenessMin);
    }
    if (typeof resolvedContract.wildcardAggressivenessMax === 'number') {
        next.wildcardAggressiveness = Math.min(next.wildcardAggressiveness, resolvedContract.wildcardAggressivenessMax);
    }
    next.preferredCategories = unique([
        ...next.preferredCategories,
        ...resolvedContract.preferredCategories,
    ]);
    next.discouragedCategories = unique([
        ...next.discouragedCategories,
        ...resolvedContract.discouragedCategories,
    ]);
    next.preferredTags = unique([...next.preferredTags, ...resolvedContract.preferredTags]);
    next.discouragedTags = unique([...next.discouragedTags, ...resolvedContract.discouragedTags]);
    next.energyBand = unique(next.energyBand
        .filter((band) => !resolvedContract.energyBandRemovals.includes(band))
        .concat(resolvedContract.energyBandAdditions));
    const roleKeys = Object.keys(resolvedContract.rolePreferences);
    for (const role of roleKeys) {
        const patch = resolvedContract.rolePreferences[role];
        if (!patch) {
            continue;
        }
        next.preferredStopShapes[role] = mergeStopShape(next.preferredStopShapes[role], patch);
    }
    if (resolvedContract.windDownExpectation.preferredCategories?.length) {
        next.windDownExpectation.preferredCategories = unique([
            ...next.windDownExpectation.preferredCategories,
            ...resolvedContract.windDownExpectation.preferredCategories,
        ]);
    }
    if (resolvedContract.windDownExpectation.discouragedCategories?.length) {
        next.windDownExpectation.discouragedCategories = unique([
            ...next.windDownExpectation.discouragedCategories,
            ...resolvedContract.windDownExpectation.discouragedCategories,
        ]);
    }
    if (typeof resolvedContract.windDownExpectation.closeToBase === 'boolean') {
        next.windDownExpectation.closeToBase = resolvedContract.windDownExpectation.closeToBase;
    }
    if (resolvedContract.windDownExpectation.maxEnergy) {
        next.windDownExpectation.maxEnergy = resolvedContract.windDownExpectation.maxEnergy;
    }
    return next;
}
function applyModeShaping(lens, intent) {
    const next = { ...lens };
    const refinements = new Set(intent.refinementModes ?? []);
    if (refinements.has('more-relaxed')) {
        next.energyBand = unique([...next.energyBand, 'low']);
        next.movementTolerance = 'low';
    }
    if (refinements.has('more-exciting')) {
        next.energyBand = unique([...next.energyBand, 'high']);
        next.wildcardAggressiveness = Math.max(next.wildcardAggressiveness, 0.7);
    }
    if (refinements.has('closer-by')) {
        next.movementTolerance = 'low';
    }
    if (refinements.has('more-unique')) {
        next.discoveryBias = 'high';
    }
    if (refinements.has('little-fancier')) {
        next.tone = next.tone === 'electric' ? 'electric' : 'refined';
        next.preferredTags = unique([...next.preferredTags, 'elevated', 'chef-led', 'craft']);
    }
    if (intent.mode === 'surprise') {
        return {
            ...next,
            discoveryBias: 'high',
            wildcardAggressiveness: Math.max(next.wildcardAggressiveness, 0.78),
            repetitionTolerance: 'medium',
            preferredTags: unique([...next.preferredTags, 'underexposed', 'unexpected']),
        };
    }
    if (intent.mode === 'curate') {
        return {
            ...next,
            discoveryBias: next.discoveryBias === 'low' ? 'medium' : next.discoveryBias,
            wildcardAggressiveness: Math.max(next.wildcardAggressiveness, 0.6),
        };
    }
    return {
        ...next,
        wildcardAggressiveness: Math.min(next.wildcardAggressiveness, 0.52),
    };
}
function applyStarterPackShaping(lens, starterPack) {
    const preset = starterPack?.lensPreset;
    if (!starterPack || !preset) {
        return lens;
    }
    const next = {
        ...lens,
        preferredCategories: [...lens.preferredCategories],
        preferredTags: [...lens.preferredTags],
        discouragedTags: [...lens.discouragedTags],
        preferredStopShapes: { ...lens.preferredStopShapes },
        windDownExpectation: { ...lens.windDownExpectation },
    };
    if (preset.lensTone) {
        next.tone = preset.lensTone;
    }
    if (preset.energyBand?.length) {
        next.energyBand = unique([...preset.energyBand]);
    }
    if (preset.discoveryBias) {
        next.discoveryBias = preset.discoveryBias;
        next.wildcardAggressiveness =
            preset.discoveryBias === 'high'
                ? Math.max(next.wildcardAggressiveness, 0.78)
                : preset.discoveryBias === 'low'
                    ? Math.min(next.wildcardAggressiveness, 0.45)
                    : next.wildcardAggressiveness;
    }
    if (preset.movementTolerance) {
        next.movementTolerance = preset.movementTolerance;
    }
    if (preset.preferredCategories?.length) {
        next.preferredCategories = unique([
            ...next.preferredCategories,
            ...preset.preferredCategories,
        ]);
    }
    if (preset.discouragedCategories?.length) {
        next.discouragedCategories = unique([
            ...next.discouragedCategories,
            ...preset.discouragedCategories,
        ]);
    }
    if (preset.preferredTags?.length) {
        next.preferredTags = unique([...next.preferredTags, ...preset.preferredTags]);
    }
    if (preset.discouragedTags?.length) {
        next.discouragedTags = unique([...next.discouragedTags, ...preset.discouragedTags]);
    }
    if (preset.preferredStopShapes) {
        const roles = Object.keys(preset.preferredStopShapes);
        for (const role of roles) {
            const patch = preset.preferredStopShapes[role];
            if (!patch) {
                continue;
            }
            next.preferredStopShapes[role] = mergeStopShape(next.preferredStopShapes[role], patch);
        }
    }
    if (preset.preferredCategories?.length) {
        const roleKeys = Object.keys(next.preferredStopShapes);
        for (const role of roleKeys) {
            next.preferredStopShapes[role] = mergeStopShape(next.preferredStopShapes[role], {
                preferredCategories: preset.preferredCategories,
            });
        }
    }
    if (preset.preferredTags?.length) {
        const roleKeys = Object.keys(next.preferredStopShapes);
        for (const role of roleKeys) {
            next.preferredStopShapes[role] = mergeStopShape(next.preferredStopShapes[role], {
                preferredTags: preset.preferredTags,
            });
        }
    }
    if (preset.windDown) {
        if (preset.windDown.preferredCategories?.length) {
            next.windDownExpectation.preferredCategories = unique([
                ...next.windDownExpectation.preferredCategories,
                ...preset.windDown.preferredCategories,
            ]);
        }
        if (preset.windDown.discouragedCategories?.length) {
            next.windDownExpectation.discouragedCategories = unique([
                ...next.windDownExpectation.discouragedCategories,
                ...preset.windDown.discouragedCategories,
            ]);
        }
        if (typeof preset.windDown.closeToBase === 'boolean') {
            next.windDownExpectation.closeToBase = preset.windDown.closeToBase;
        }
        if (preset.windDown.maxEnergy) {
            next.windDownExpectation.maxEnergy = preset.windDown.maxEnergy;
        }
    }
    return next;
}
function buildPersonaEffectSummary(intent) {
    if (!intent.persona || intent.personaSource !== 'explicit') {
        return 'No persona modifier applied.';
    }
    if (intent.persona === 'romantic') {
        return 'Refined toward intimate pacing and calmer wind-down choices.';
    }
    if (intent.persona === 'friends') {
        return 'Refined toward social energy and more interactive highlight options.';
    }
    return 'Refined toward comfortable pacing and broader all-ages accessibility.';
}
function applyStrictDebugShaping(lens, intent, starterPack) {
    const next = {
        ...lens,
        energyBand: [...lens.energyBand],
        preferredCategories: [...lens.preferredCategories],
        discouragedCategories: [...lens.discouragedCategories],
        preferredTags: [...lens.preferredTags],
        discouragedTags: [...lens.discouragedTags],
        preferredStopShapes: { ...lens.preferredStopShapes },
        windDownExpectation: { ...lens.windDownExpectation },
    };
    if (intent.personaSource === 'explicit' && intent.crew === 'curator') {
        next.energyBand = unique(next.energyBand.filter((band) => band !== 'high'));
        next.movementTolerance = 'low';
        next.discouragedCategories = unique([
            ...next.discouragedCategories,
            'bar',
            'live_music',
            'event',
        ]);
        next.preferredStopShapes.highlight = mergeStopShape(next.preferredStopShapes.highlight, {
            preferredCategories: ['museum', 'park', 'activity'],
            discouragedCategories: ['bar', 'live_music', 'event'],
        });
    }
    if (intent.personaSource === 'explicit' && intent.crew === 'romantic') {
        next.tone = 'intimate';
        next.movementTolerance = 'low';
        next.energyBand = unique(next.energyBand.filter((band) => band !== 'high'));
        next.preferredStopShapes.start = mergeStopShape(next.preferredStopShapes.start, {
            preferredCategories: ['cafe', 'park', 'restaurant'],
            preferredTags: ['cozy', 'intimate'],
        });
        next.preferredStopShapes.windDown = mergeStopShape(next.preferredStopShapes.windDown, {
            preferredCategories: ['dessert', 'cafe', 'park'],
            discouragedCategories: ['activity', 'event'],
            energyPreference: ['low'],
        });
        next.windDownExpectation.closeToBase = true;
        next.windDownExpectation.maxEnergy = 'low';
    }
    if (starterPack?.id === 'cozy-jazz-night') {
        next.preferredStopShapes.highlight = mergeStopShape(next.preferredStopShapes.highlight, {
            preferredCategories: ['live_music', 'bar'],
            preferredTags: ['listening', 'live', 'intimate'],
        });
        next.preferredStopShapes.windDown = mergeStopShape(next.preferredStopShapes.windDown, {
            preferredCategories: ['dessert', 'cafe'],
            energyPreference: ['low'],
        });
    }
    if (starterPack?.id === 'museum-afternoon') {
        next.preferredStopShapes.highlight = mergeStopShape(next.preferredStopShapes.highlight, {
            preferredCategories: ['museum'],
            preferredTags: ['curated', 'hands-on', 'interactive'],
            discouragedCategories: ['bar', 'live_music'],
        });
    }
    if (starterPack?.id === 'cozy-date-night' || starterPack?.id === 'wine-slow-evening') {
        next.preferredStopShapes.highlight = mergeStopShape(next.preferredStopShapes.highlight, {
            preferredCategories: ['restaurant', 'dessert', 'bar'],
            discouragedCategories: ['live_music', 'event'],
            preferredTags: ['cozy', 'intimate', 'conversation', 'craft'],
            discouragedTags: ['festival', 'chaotic'],
        });
    }
    return {
        ...next,
        preferredCategories: unique(next.preferredCategories),
        discouragedCategories: unique(next.discouragedCategories),
        preferredTags: unique(next.preferredTags),
        discouragedTags: unique(next.discouragedTags),
        energyBand: unique(next.energyBand.length > 0 ? next.energyBand : ['low', 'medium']),
    };
}
export function buildExperienceLens({ intent, starterPack, strictShape = false, }) {
    const resolvedContractPackage = resolveHospitalityContract(intent);
    const base = buildNeutralBaseline();
    const afterVibe = applyVibeShaping(base, intent);
    const afterPersona = applyResolvedContractShaping(afterVibe, resolvedContractPackage.resolvedContract);
    const afterMode = applyModeShaping(afterPersona, intent);
    const tasteMode = selectTasteMode(intent);
    const afterTasteMode = applyTasteModeToLens(afterMode, tasteMode);
    const afterPack = applyStarterPackShaping(afterTasteMode, starterPack);
    const strictShaped = strictShape
        ? applyStrictDebugShaping(afterPack, intent, starterPack)
        : afterPack;
    return {
        ...strictShaped,
        tasteMode,
        personaContract: resolvedContractPackage.personaContract,
        resolvedContract: resolvedContractPackage.resolvedContract,
        interpretation: {
            primaryVibe: intent.primaryAnchor,
            personaModifier: intent.persona ?? undefined,
            personaSource: intent.personaSource ?? 'derived',
            personaEffectSummary: resolvedContractPackage.resolvedContract.persona
                ? resolvedContractPackage.resolvedContract.resolutionSummary
                : buildPersonaEffectSummary(intent),
        },
        preferredCategories: unique(strictShaped.preferredCategories),
        discouragedCategories: unique(strictShaped.discouragedCategories),
        preferredTags: unique(strictShaped.preferredTags),
        discouragedTags: unique(strictShaped.discouragedTags),
        energyBand: unique(strictShaped.energyBand.length > 0 ? strictShaped.energyBand : [toEnergyBand(2.5)]),
    };
}
