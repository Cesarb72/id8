import { buildRolePools } from '../arc/buildRolePools';
import { getRoleContract } from '../contracts/getRoleContract';
import { deriveReadableDistrictName } from '../districts/deriveReadableDistrictName';
import { buildExperienceLens } from '../intent/buildExperienceLens';
import { getCrewPolicy } from '../intent/getCrewPolicy';
import { normalizeIntent } from '../intent/normalizeIntent';
import { retrieveVenues } from '../retrieval/retrieveVenues';
import { scoreVenueCollection } from '../retrieval/scoreVenueFit';
import { getVibeLabel } from '../types/intent';
const ROLE_CONFIG = [
    {
        poolKey: 'warmup',
        role: 'start',
        title: 'Start',
        subtitle: 'How the route opens.',
    },
    {
        poolKey: 'peak',
        role: 'highlight',
        title: 'Highlight',
        subtitle: 'Where the night gathers energy.',
    },
    {
        poolKey: 'cooldown',
        role: 'windDown',
        title: 'Wind Down',
        subtitle: 'How it lands.',
    },
];
function formatCategory(category) {
    return category.replace('_', ' ');
}
function firstSentence(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    const sentence = trimmed.split(/[.!?]/)[0]?.trim() ?? trimmed;
    return sentence.length > 0 ? `${sentence}.` : trimmed;
}
function getVibeTone(vibe) {
    return getVibeLabel(vibe).toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim();
}
function incrementMapCount(counts, key) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
}
function getCoarseDiscoveryCategory(candidate) {
    const venue = candidate.venue;
    const tagSet = new Set(venue.tags.map((tag) => tag.toLowerCase()));
    const subcategory = venue.subcategory.toLowerCase();
    if (venue.category === 'cafe') {
        return 'coffee';
    }
    if (venue.category === 'restaurant') {
        return 'restaurant';
    }
    if (venue.category === 'bar') {
        return 'bar';
    }
    if (venue.category === 'dessert') {
        return 'dessert';
    }
    if (venue.category === 'activity') {
        if (venue.vibeTags.includes('outdoors') || tagSet.has('outdoor') || subcategory.includes('park')) {
            return 'outdoor';
        }
        return 'activity';
    }
    if (venue.category === 'park') {
        return 'outdoor';
    }
    if (venue.category === 'live_music' ||
        venue.category === 'museum' ||
        venue.category === 'event' ||
        tagSet.has('movie') ||
        tagSet.has('cinema') ||
        tagSet.has('music') ||
        subcategory.includes('movie') ||
        subcategory.includes('cinema')) {
        return 'entertainment';
    }
    return 'other';
}
function getDiscoveryExperienceLane(candidate) {
    const coarseCategory = getCoarseDiscoveryCategory(candidate);
    if (coarseCategory === 'restaurant') {
        return 'dining';
    }
    if (coarseCategory === 'coffee' || coarseCategory === 'bar') {
        return 'drinks';
    }
    if (coarseCategory === 'dessert') {
        return 'sweet';
    }
    if (coarseCategory === 'activity') {
        return 'activity';
    }
    if (coarseCategory === 'outdoor') {
        return 'outdoor';
    }
    if (coarseCategory === 'entertainment') {
        return 'entertainment';
    }
    return 'other';
}
function buildDiscoveryReason(candidate, role) {
    if (role === 'highlight' && candidate.highlightValidity.validityLevel === 'valid') {
        return 'Strong fit for the main moment.';
    }
    if (role === 'start' && candidate.stopShapeFit.start >= 0.62) {
        return 'Easy opener with a strong first-stop fit.';
    }
    if (role === 'windDown' &&
        candidate.stopShapeFit.windDown >= 0.62 &&
        candidate.venue.energyLevel <= 3) {
        return 'Soft finish with easy linger energy.';
    }
    return firstSentence(candidate.venue.shortDescription);
}
function buildAreaLabel(candidate) {
    const readableDistrict = deriveReadableDistrictName(candidate.venue.neighborhood, {
        city: candidate.venue.city,
    });
    return `${readableDistrict.displayName} | ${candidate.venue.driveMinutes} min away`;
}
function buildCandidate(role, candidate) {
    return {
        venueId: candidate.venue.id,
        role,
        name: candidate.venue.name,
        categoryLabel: formatCategory(candidate.venue.category),
        reason: buildDiscoveryReason(candidate, role),
        areaLabel: buildAreaLabel(candidate),
    };
}
function collectDirectionNeighborhoods(rolePools, city) {
    const counts = new Map();
    const candidates = [...rolePools.warmup, ...rolePools.peak, ...rolePools.cooldown].slice(0, 24);
    for (const candidate of candidates) {
        const neighborhood = candidate.venue.neighborhood;
        counts.set(neighborhood, (counts.get(neighborhood) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([neighborhood]) => ({
        neighborhood,
        label: deriveReadableDistrictName(neighborhood, { city }).displayName,
    }));
}
function buildDirectionStrategies(params) {
    const vibeTone = getVibeTone(params.primaryVibe);
    const strategies = [
        {
            id: 'close-knit',
            title: 'Keep it close',
            narrative: `A ${vibeTone} route that stays tight and settles in quickly.`,
            selectionOrder: ['start', 'highlight', 'windDown'],
            baseNeighborhood: params.defaultNeighborhood,
            focusNeighborhood: params.defaultNeighborhood,
            focusNeighborhoodWeight: 1.25,
            closenessBias: 1.2,
            highlightBias: 0.15,
            softLandingBias: 0.55,
            explorationBias: 0,
            contrastBias: 0.35,
            varietyBias: 0.45,
            uniquenessBias: 0.2,
        },
        {
            id: 'main-stop',
            title: params.hasAnchor ? 'Let the main stop lead' : 'Center it on one strong stop',
            narrative: params.hasAnchor
                ? `A ${vibeTone} route shaped around your anchor with lighter support around it.`
                : `A ${vibeTone} route with a stronger main stop and lighter support around it.`,
            selectionOrder: ['highlight', 'start', 'windDown'],
            baseNeighborhood: params.defaultNeighborhood,
            focusNeighborhood: params.defaultNeighborhood,
            focusNeighborhoodWeight: 0.7,
            closenessBias: 0.35,
            highlightBias: 1.1,
            softLandingBias: 0.2,
            explorationBias: 0.2,
            contrastBias: 0.75,
            varietyBias: 0.55,
            uniquenessBias: 0.35,
        },
    ];
    const alternatePocket = params.alternateNeighborhoods[0];
    if (alternatePocket) {
        strategies.push({
            id: 'nearby-pocket',
            title: 'Try a nearby pocket',
            narrative: `A ${vibeTone} route that drifts toward ${alternatePocket.label} for a different nearby pocket.`,
            selectionOrder: ['highlight', 'start', 'windDown'],
            baseNeighborhood: params.defaultNeighborhood,
            focusNeighborhood: alternatePocket.neighborhood,
            focusNeighborhoodWeight: 1.35,
            closenessBias: 0.55,
            highlightBias: 0.45,
            softLandingBias: 0.35,
            explorationBias: 1.25,
            contrastBias: 1.15,
            varietyBias: 0.9,
            uniquenessBias: 0.95,
        });
    }
    else {
        strategies.push({
            id: 'slow-finish',
            title: 'Leave room to linger',
            narrative: `A ${vibeTone} route that opens easy and leaves more room for a slower finish.`,
            selectionOrder: ['windDown', 'highlight', 'start'],
            baseNeighborhood: params.defaultNeighborhood,
            focusNeighborhood: params.defaultNeighborhood,
            focusNeighborhoodWeight: 0.55,
            closenessBias: 0.4,
            highlightBias: 0.25,
            softLandingBias: 1.05,
            explorationBias: 0,
            contrastBias: 0.65,
            varietyBias: 0.7,
            uniquenessBias: 0.3,
        });
    }
    return strategies;
}
function scoreDirectionCandidate(params) {
    const { candidate, role, rank, strategy, usageState, directionCategoryCounts, directionLaneCounts, protectedVenueIds, } = params;
    const protectedCandidate = candidate.isAnchor || protectedVenueIds.has(candidate.venue.id);
    const coarseCategory = getCoarseDiscoveryCategory(candidate);
    const lane = getDiscoveryExperienceLane(candidate);
    const normalizedRankScore = Math.max(0, 20 - rank) * 4;
    const distanceScore = Math.max(0, 18 - candidate.venue.driveMinutes) * 0.55;
    const samePocketBonus = strategy.focusNeighborhood && candidate.venue.neighborhood === strategy.focusNeighborhood
        ? strategy.focusNeighborhoodWeight * 14
        : 0;
    const explorationPocketBonus = strategy.baseNeighborhood && candidate.venue.neighborhood !== strategy.baseNeighborhood
        ? strategy.explorationBias * 8
        : 0;
    const fallbackToBasePocketPenalty = strategy.id === 'nearby-pocket' &&
        strategy.baseNeighborhood &&
        candidate.venue.neighborhood === strategy.baseNeighborhood
        ? 7
        : 0;
    const highlightBonus = role === 'highlight'
        ? strategy.highlightBias * 18 +
            (candidate.highlightValidity.validityLevel === 'valid' ? 8 : 0)
        : 0;
    const startBonus = role === 'start' ? strategy.closenessBias * candidate.stopShapeFit.start * 12 : 0;
    const windDownBonus = role === 'windDown'
        ? strategy.softLandingBias * (candidate.stopShapeFit.windDown * 10 + (4 - candidate.venue.energyLevel))
        : 0;
    const anchorBonus = role === 'highlight' && candidate.isAnchor ? 220 : 0;
    const uniquenessBonus = strategy.uniquenessBias *
        (candidate.venue.distinctivenessScore * 10 +
            candidate.hiddenGemScore * 8 +
            candidate.venue.underexposureScore * 8);
    const crossDirectionCategoryPenalty = protectedCandidate
        ? 0
        : (usageState.categoryCounts.get(coarseCategory) ?? 0) * (6 + strategy.contrastBias * 4);
    const crossDirectionLanePenalty = protectedCandidate
        ? 0
        : (usageState.laneCounts.get(lane) ?? 0) * (5 + strategy.contrastBias * 4);
    const withinDirectionCategoryPenalty = protectedCandidate
        ? 0
        : (directionCategoryCounts.get(coarseCategory) ?? 0) * (12 + strategy.varietyBias * 6);
    const withinDirectionLanePenalty = protectedCandidate
        ? 0
        : (directionLaneCounts.get(lane) ?? 0) * (8 + strategy.varietyBias * 5);
    const sameVenuePenalty = usageState.venueIds.has(candidate.venue.id) && !protectedCandidate ? 36 : 0;
    const freshCategoryBonus = !protectedCandidate && (usageState.categoryCounts.get(coarseCategory) ?? 0) === 0
        ? 5 + strategy.contrastBias * 5
        : 0;
    const freshLaneBonus = !protectedCandidate && (usageState.laneCounts.get(lane) ?? 0) === 0
        ? 4 + strategy.contrastBias * 4
        : 0;
    return (normalizedRankScore +
        strategy.closenessBias * distanceScore +
        samePocketBonus +
        explorationPocketBonus +
        highlightBonus +
        startBonus +
        windDownBonus +
        uniquenessBonus +
        anchorBonus -
        fallbackToBasePocketPenalty -
        crossDirectionCategoryPenalty -
        crossDirectionLanePenalty -
        withinDirectionCategoryPenalty -
        withinDirectionLanePenalty -
        sameVenuePenalty +
        freshCategoryBonus +
        freshLaneBonus);
}
function buildDirectionGroups(params) {
    const directionUsedIds = new Set();
    const directionCategoryCounts = new Map();
    const directionLaneCounts = new Map();
    const selectedByRole = new Map();
    const roleConfigByRole = new Map(ROLE_CONFIG.map((config) => [config.role, config]));
    for (const role of params.strategy.selectionOrder) {
        const config = roleConfigByRole.get(role);
        if (!config) {
            continue;
        }
        const pool = params.rolePools[config.poolKey];
        const candidate = pool
            .slice(0, 14)
            .map((item, rank) => ({
            item,
            score: scoreDirectionCandidate({
                candidate: item,
                role: config.role,
                rank,
                strategy: params.strategy,
                usageState: params.usageState,
                directionCategoryCounts,
                directionLaneCounts,
                protectedVenueIds: params.protectedVenueIds,
            }),
        }))
            .sort((left, right) => right.score - left.score)
            .find(({ item }) => !directionUsedIds.has(item.venue.id));
        if (!candidate) {
            continue;
        }
        directionUsedIds.add(candidate.item.venue.id);
        selectedByRole.set(config.role, candidate.item);
        const category = getCoarseDiscoveryCategory(candidate.item);
        const lane = getDiscoveryExperienceLane(candidate.item);
        incrementMapCount(directionCategoryCounts, category);
        incrementMapCount(directionLaneCounts, lane);
    }
    for (const selected of selectedByRole.values()) {
        const protectedCandidate = selected.isAnchor || params.protectedVenueIds.has(selected.venue.id);
        if (!protectedCandidate) {
            params.usageState.venueIds.add(selected.venue.id);
            incrementMapCount(params.usageState.categoryCounts, getCoarseDiscoveryCategory(selected));
            incrementMapCount(params.usageState.laneCounts, getDiscoveryExperienceLane(selected));
        }
    }
    return ROLE_CONFIG.map((config) => {
        const candidate = selectedByRole.get(config.role);
        if (!candidate) {
            return undefined;
        }
        return {
            role: config.role,
            title: config.title,
            subtitle: config.subtitle,
            candidates: [buildCandidate(config.role, candidate)],
        };
    }).filter((group) => Boolean(group));
}
function buildProtectedVenueIds(intent) {
    const protectedVenueIds = new Set();
    if (intent.anchor?.venueId) {
        protectedVenueIds.add(intent.anchor.venueId);
    }
    for (const preference of intent.discoveryPreferences ?? []) {
        protectedVenueIds.add(preference.venueId);
    }
    return protectedVenueIds;
}
export async function getDiscoveryCandidates(input, options = {}) {
    const intent = normalizeIntent(input);
    const lens = buildExperienceLens({
        intent,
        starterPack: options.starterPack,
        strictShape: options.strictShape,
    });
    const crewPolicy = getCrewPolicy(intent.crew);
    const roleContracts = getRoleContract({
        intent,
        starterPack: options.starterPack,
        strictShapeEnabled: options.strictShape,
    });
    const retrieval = await retrieveVenues(intent, lens, {
        requestedSourceMode: options.sourceMode,
        sourceModeOverrideApplied: options.sourceModeOverrideApplied,
        starterPack: options.starterPack,
    });
    const scoredVenues = scoreVenueCollection(retrieval.venues, intent, crewPolicy, lens, roleContracts, options.starterPack);
    const rolePools = buildRolePools(scoredVenues, crewPolicy, lens, intent, roleContracts, options.strictShape);
    const directionNeighborhoods = collectDirectionNeighborhoods(rolePools, intent.city);
    const anchoredHighlightNeighborhood = intent.anchor?.role === 'highlight'
        ? rolePools.peak.find((candidate) => candidate.isAnchor)?.venue.neighborhood
        : undefined;
    const defaultNeighborhood = intent.neighborhood ?? anchoredHighlightNeighborhood ?? directionNeighborhoods[0]?.neighborhood;
    const alternateNeighborhoods = directionNeighborhoods.filter((entry) => entry.neighborhood !== defaultNeighborhood);
    const strategies = buildDirectionStrategies({
        primaryVibe: intent.primaryAnchor,
        defaultNeighborhood,
        alternateNeighborhoods: intent.neighborhood || intent.district ? [] : alternateNeighborhoods,
        hasAnchor: Boolean(intent.anchor),
    });
    const usageState = {
        venueIds: new Set(),
        categoryCounts: new Map(),
        laneCounts: new Map(),
    };
    const protectedVenueIds = buildProtectedVenueIds(intent);
    const signatures = new Set();
    const directions = [];
    for (const strategy of strategies) {
        const groups = buildDirectionGroups({
            rolePools,
            strategy,
            usageState,
            protectedVenueIds,
        });
        if (groups.length === 0) {
            continue;
        }
        const signature = groups
            .flatMap((group) => group.candidates.map((candidate) => candidate.venueId))
            .join('|');
        if (signatures.has(signature)) {
            continue;
        }
        signatures.add(signature);
        directions.push({
            id: strategy.id,
            title: strategy.title,
            narrative: strategy.narrative,
            pocketLabel: strategy.focusNeighborhood
                ? deriveReadableDistrictName(strategy.focusNeighborhood, { city: intent.city }).displayName
                : undefined,
            groups,
        });
    }
    return directions;
}
