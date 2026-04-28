function unique(values) {
    return [...new Set(values)];
}
function emptyShape() {
    return {
        preferredCategories: [],
        discouragedCategories: [],
        preferredTags: [],
        discouragedTags: [],
        energyPreference: [],
    };
}
function mergeShape(base, patch) {
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
        discouragedTags: unique([...(base.discouragedTags ?? []), ...(patch.discouragedTags ?? [])]),
        energyPreference: unique([
            ...(base.energyPreference ?? []),
            ...(patch.energyPreference ?? []),
        ]),
    };
}
function roleRulePatch(label, strength, shape, maxEnergyLevel) {
    return {
        label,
        strength,
        preferredCategories: shape.preferredCategories ?? [],
        discouragedCategories: shape.discouragedCategories ?? [],
        preferredTags: shape.preferredTags ?? [],
        discouragedTags: shape.discouragedTags ?? [],
        maxEnergyLevel,
    };
}
function getBlendMode(vibe, persona) {
    if (!persona) {
        return {
            blendMode: 'vibe_only',
            compatibility: 'reinforcing',
            resolutionSummary: 'Vibe-only contract; no explicit persona modifier applied.',
            priority: {
                highlightStructure: 'vibe',
                pacingEnergy: 'vibe',
                rolePreferences: 'vibe',
            },
        };
    }
    if (persona === 'romantic') {
        if (vibe === 'cozy' || vibe === 'chill' || vibe === 'cultured' || vibe === 'adventurous-outdoor') {
            return {
                blendMode: 'aligned',
                compatibility: 'reinforcing',
                resolutionSummary: vibe === 'cultured'
                    ? 'Cultured supplies thoughtful setting while romantic requires an intimate highlight moment.'
                    : vibe === 'adventurous-outdoor'
                        ? 'Outdoor exploration supplies the setting while romantic resolves the highlight into a scenic shared moment.'
                        : 'Cozy pacing and romantic intent reinforce each other into a low-energy intimate moment.',
                priority: {
                    highlightStructure: 'persona',
                    pacingEnergy: 'balanced',
                    rolePreferences: 'balanced',
                },
            };
        }
        return {
            blendMode: 'selective_energy',
            compatibility: 'tension',
            resolutionSummary: 'Vibe supplies movement and selective energy, while romantic caps chaos and keeps the highlight date-shaped.',
            priority: {
                highlightStructure: 'persona',
                pacingEnergy: 'balanced',
                rolePreferences: 'balanced',
            },
        };
    }
    if (persona === 'friends') {
        if (vibe === 'cozy' || vibe === 'chill' || vibe === 'cultured') {
            return {
                blendMode: 'tension',
                compatibility: 'tension',
                resolutionSummary: 'Vibe keeps the route calmer, while friends preserves one social focal point without flattening into a generic middle.',
                priority: {
                    highlightStructure: 'balanced',
                    pacingEnergy: 'vibe',
                    rolePreferences: 'balanced',
                },
            };
        }
        return {
            blendMode: 'aligned',
            compatibility: 'reinforcing',
            resolutionSummary: 'Social persona and energetic vibe reinforce each other around movement, interaction, and a louder highlight.',
            priority: {
                highlightStructure: 'balanced',
                pacingEnergy: 'balanced',
                rolePreferences: 'balanced',
            },
        };
    }
    if (vibe === 'lively' || vibe === 'playful' || vibe === 'adventurous-urban') {
        return {
            blendMode: 'selective_energy',
            compatibility: 'tension',
            resolutionSummary: 'Vibe supplies activity, while family caps adult-nightlife pressure and keeps the route accessible.',
            priority: {
                highlightStructure: 'persona',
                pacingEnergy: 'balanced',
                rolePreferences: 'persona',
            },
        };
    }
    return {
        blendMode: 'aligned',
        compatibility: 'reinforcing',
        resolutionSummary: 'Vibe and family persona both support calmer pacing, accessibility, and lower-noise highlights.',
        priority: {
            highlightStructure: 'persona',
            pacingEnergy: 'balanced',
            rolePreferences: 'persona',
        },
    };
}
function buildRomanticContract(vibe) {
    const baseStart = mergeShape(emptyShape(), {
        preferredCategories: ['cafe', 'park', 'dessert'],
        discouragedCategories: ['activity'],
        preferredTags: ['cozy', 'intimate', 'calm'],
    });
    const baseHighlight = mergeShape(emptyShape(), {
        preferredCategories: ['park', 'activity', 'museum', 'live_music', 'dessert', 'restaurant'],
        discouragedCategories: ['event', 'bar'],
        preferredTags: ['scenic', 'ambient', 'craft', 'design-forward', 'walkable'],
        energyPreference: ['low', 'medium'],
    });
    const baseWindDown = mergeShape(emptyShape(), {
        preferredCategories: ['dessert', 'cafe', 'park'],
        discouragedCategories: ['activity', 'event'],
        preferredTags: ['calm', 'easygoing'],
        energyPreference: ['low'],
    });
    let highlight = baseHighlight;
    let start = baseStart;
    let windDown = baseWindDown;
    let preferredCategories = ['restaurant', 'dessert', 'park'];
    let discouragedCategories = ['event'];
    let preferredTags = ['cozy', 'intimate', 'craft', 'conversation'];
    let discouragedTags = ['high-energy', 'arcade'];
    let energyBandAdditions = [];
    let energyBandRemovals = [];
    let movementToleranceCap = 'medium';
    let toneOverride = 'intimate';
    let windDownExpectation = {
        closeToBase: true,
    };
    let highlightEnergyPreference = ['low', 'medium'];
    if (vibe === 'lively' || vibe === 'playful' || vibe === 'adventurous-urban') {
        highlight = mergeShape(highlight, {
            preferredCategories: vibe === 'playful' ? ['activity', 'dessert'] : ['live_music', 'activity', 'restaurant'],
            preferredTags: vibe === 'lively'
                ? ['listening', 'stylish', 'intimate']
                : vibe === 'adventurous-urban'
                    ? ['walkable', 'local', 'design-forward']
                    : ['playful', 'shared'],
            discouragedTags: ['chaotic', 'festival'],
            energyPreference: ['medium'],
        });
        start = mergeShape(start, {
            energyPreference: ['low', 'medium'],
        });
        preferredTags = unique([...preferredTags, 'shared', 'intentional']);
        discouragedTags = unique([...discouragedTags, 'chaotic']);
        movementToleranceCap = 'medium';
        energyBandAdditions = ['medium'];
        energyBandRemovals = vibe === 'playful' ? ['high'] : [];
        windDownExpectation = {
            closeToBase: true,
            maxEnergy: 'low',
        };
        highlightEnergyPreference = ['medium'];
    }
    else if (vibe === 'cultured') {
        highlight = mergeShape(highlight, {
            preferredCategories: ['museum', 'live_music'],
            preferredTags: ['thoughtful', 'listening', 'curated'],
        });
        preferredTags = unique([...preferredTags, 'thoughtful', 'curated']);
        windDownExpectation = {
            closeToBase: true,
            maxEnergy: 'low',
        };
    }
    else if (vibe === 'adventurous-outdoor') {
        highlight = mergeShape(highlight, {
            preferredCategories: ['park', 'activity'],
            preferredTags: ['garden', 'viewpoint', 'stroll'],
        });
        start = mergeShape(start, {
            preferredCategories: ['park', 'cafe'],
            preferredTags: ['walkable', 'fresh-air'],
        });
        preferredTags = unique([...preferredTags, 'garden', 'stroll']);
        windDown = mergeShape(windDown, {
            preferredCategories: ['park', 'dessert', 'cafe'],
        });
    }
    const resolvedContract = {
        primaryVibe: vibe,
        persona: 'romantic',
        ...getBlendMode(vibe, 'romantic'),
        toneOverride,
        movementToleranceCap,
        repetitionToleranceOverride: 'low',
        wildcardAggressivenessMax: 0.42,
        energyBandAdditions,
        energyBandRemovals,
        preferredCategories,
        discouragedCategories,
        preferredTags,
        discouragedTags,
        rolePreferences: {
            start,
            highlight,
            windDown,
        },
        windDownExpectation,
        highlight: {
            requiresMomentPresence: true,
            requireMomentPresenceStrength: 'soft',
            preferredHighlightTypes: ['activity', 'scenic', 'ambient'],
            discourageGenericHighlight: true,
            preferredCategories: highlight.preferredCategories ?? [],
            discouragedCategories: highlight.discouragedCategories ?? [],
            preferredTags: highlight.preferredTags ?? [],
            discouragedTags: highlight.discouragedTags ?? [],
            energyPreference: highlightEnergyPreference,
        },
    };
    return {
        resolvedContract,
        personaContract: {
            persona: 'romantic',
            requiresMomentPresence: true,
            requireMomentPresenceStrength: 'soft',
            preferredHighlightTypes: ['activity', 'scenic', 'ambient'],
            discourageGenericHighlight: true,
        },
        roleRulePatches: {
            start: roleRulePatch('Resolved romantic start contract', 'strong', start),
            highlight: roleRulePatch('Resolved romantic highlight contract', 'strong', highlight, resolvedContract.highlight.energyPreference.includes('low') ? 3 : 4),
            windDown: roleRulePatch('Resolved romantic wind-down contract', 'strong', windDown, 3),
        },
    };
}
function buildFriendsContract(vibe) {
    const highlight = mergeShape(emptyShape(), {
        preferredCategories: vibe === 'cozy' || vibe === 'chill' || vibe === 'cultured'
            ? ['activity', 'live_music', 'restaurant']
            : ['activity', 'live_music', 'bar', 'event'],
        preferredTags: ['social', 'interactive'],
        discouragedCategories: vibe === 'cozy' || vibe === 'chill' ? ['park'] : [],
        energyPreference: vibe === 'cozy' || vibe === 'chill' || vibe === 'cultured' ? ['medium'] : ['medium', 'high'],
    });
    const start = mergeShape(emptyShape(), {
        preferredCategories: ['activity', 'restaurant', 'cafe'],
        preferredTags: ['social', 'playful'],
        energyPreference: ['medium'],
    });
    const surprise = mergeShape(emptyShape(), {
        preferredCategories: ['event', 'activity', 'dessert'],
        preferredTags: ['community', 'unexpected'],
        energyPreference: ['medium', 'high'],
    });
    const resolvedContract = {
        primaryVibe: vibe,
        persona: 'friends',
        ...getBlendMode(vibe, 'friends'),
        toneOverride: vibe === 'cozy' || vibe === 'chill' ? undefined : 'electric',
        movementToleranceOverride: vibe === 'cozy' || vibe === 'chill' || vibe === 'cultured' ? undefined : 'high',
        repetitionToleranceOverride: vibe === 'cozy' || vibe === 'chill' ? 'medium' : undefined,
        wildcardAggressivenessMin: 0.58,
        energyBandAdditions: vibe === 'cozy' || vibe === 'chill' || vibe === 'cultured' ? [] : ['high'],
        energyBandRemovals: [],
        preferredCategories: ['activity', 'bar', 'live_music', 'event'],
        discouragedCategories: [],
        preferredTags: ['social', 'buzzing', 'interactive'],
        discouragedTags: ['silent'],
        rolePreferences: {
            start,
            highlight,
            surprise,
        },
        windDownExpectation: {
            closeToBase: false,
        },
        highlight: {
            requiresMomentPresence: false,
            requireMomentPresenceStrength: 'none',
            preferredHighlightTypes: [],
            discourageGenericHighlight: false,
            preferredCategories: highlight.preferredCategories ?? [],
            discouragedCategories: highlight.discouragedCategories ?? [],
            preferredTags: highlight.preferredTags ?? [],
            discouragedTags: [],
            energyPreference: highlight.energyPreference ?? [],
        },
    };
    return {
        resolvedContract,
        roleRulePatches: {
            start: roleRulePatch('Resolved friends start contract', 'soft', start),
            highlight: roleRulePatch('Resolved friends highlight contract', 'soft', highlight),
            surprise: roleRulePatch('Resolved friends surprise contract', 'soft', surprise),
            windDown: roleRulePatch('Resolved friends wind-down contract', 'soft', mergeShape(emptyShape(), {
                preferredCategories: ['dessert', 'bar', 'cafe', 'restaurant'],
            })),
        },
    };
}
function buildFamilyContract(vibe) {
    const highlight = mergeShape(emptyShape(), {
        preferredCategories: vibe === 'lively' || vibe === 'playful' || vibe === 'adventurous-urban'
            ? ['museum', 'activity', 'event', 'park']
            : ['museum', 'park', 'activity', 'event', 'cafe'],
        discouragedCategories: ['bar', 'live_music'],
        preferredTags: ['interactive', 'accessible', 'hands-on'],
        energyPreference: ['low', 'medium'],
    });
    const resolvedContract = {
        primaryVibe: vibe,
        persona: 'family',
        ...getBlendMode(vibe, 'family'),
        movementToleranceOverride: vibe === 'lively' || vibe === 'playful' || vibe === 'adventurous-urban'
            ? undefined
            : 'low',
        movementToleranceCap: 'medium',
        repetitionToleranceOverride: 'low',
        wildcardAggressivenessMin: 0.38,
        wildcardAggressivenessMax: 0.5,
        energyBandAdditions: [],
        energyBandRemovals: [],
        preferredCategories: ['museum', 'park', 'activity', 'dessert'],
        discouragedCategories: ['bar', 'live_music'],
        preferredTags: ['hands-on', 'accessible', 'walkable'],
        discouragedTags: ['late-night', 'crowded'],
        rolePreferences: {
            start: {
                preferredCategories: ['park', 'museum', 'cafe'],
                preferredTags: ['easygoing', 'hands-on'],
            },
            highlight,
            windDown: {
                preferredCategories: ['park', 'dessert', 'cafe'],
                preferredTags: ['calm', 'accessible'],
                discouragedCategories: ['bar', 'live_music'],
                energyPreference: ['low'],
            },
        },
        windDownExpectation: {
            closeToBase: true,
            maxEnergy: 'low',
        },
        highlight: {
            requiresMomentPresence: false,
            requireMomentPresenceStrength: 'none',
            preferredHighlightTypes: [],
            discourageGenericHighlight: false,
            preferredCategories: highlight.preferredCategories ?? [],
            discouragedCategories: highlight.discouragedCategories ?? [],
            preferredTags: highlight.preferredTags ?? [],
            discouragedTags: [],
            energyPreference: highlight.energyPreference ?? ['low', 'medium'],
        },
    };
    return {
        resolvedContract,
        roleRulePatches: {
            start: roleRulePatch('Resolved family start contract', 'strong', resolvedContract.rolePreferences.start ?? {}, 3),
            highlight: {
                ...roleRulePatch('Resolved family highlight contract', 'hard', highlight, 4),
                requiredCategories: ['museum', 'park', 'activity', 'event', 'cafe'],
                requiredTags: ['family-friendly', 'accessible', 'hands-on', 'walkable'],
            },
            windDown: roleRulePatch('Resolved family wind-down contract', 'strong', resolvedContract.rolePreferences.windDown ?? {}, 3),
        },
    };
}
function buildVibeOnlyContract(vibe) {
    return {
        resolvedContract: {
            primaryVibe: vibe,
            ...getBlendMode(vibe, undefined),
            energyBandAdditions: [],
            energyBandRemovals: [],
            preferredCategories: [],
            discouragedCategories: [],
            preferredTags: [],
            discouragedTags: [],
            rolePreferences: {},
            windDownExpectation: {},
            highlight: {
                requiresMomentPresence: false,
                requireMomentPresenceStrength: 'none',
                preferredHighlightTypes: [],
                discourageGenericHighlight: false,
                preferredCategories: [],
                discouragedCategories: [],
                preferredTags: [],
                discouragedTags: [],
                energyPreference: [],
            },
        },
        roleRulePatches: {},
    };
}
export function resolveHospitalityContract(intent) {
    const persona = intent.personaSource === 'explicit' ? intent.persona : undefined;
    if (persona === 'romantic') {
        return buildRomanticContract(intent.primaryAnchor);
    }
    if (persona === 'friends') {
        return buildFriendsContract(intent.primaryAnchor);
    }
    if (persona === 'family') {
        return buildFamilyContract(intent.primaryAnchor);
    }
    return buildVibeOnlyContract(intent.primaryAnchor);
}
