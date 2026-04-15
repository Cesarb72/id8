import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { ProgressDots } from '../components/flow/ProgressDots';
import { EngineDebugPanel } from '../components/debug/EngineDebugPanel';
import { starterPacks } from '../data/starterPacks';
import { canApplyComposeSearchResult, getComposeActionTargetRole, getDraftComposeActions, insertArcStop, } from '../domain/arc/composeDraftArc';
import { getRoleAlternatives } from '../domain/arc/getRoleAlternatives';
import { isValidArcCombination } from '../domain/arc/isValidArcCombination';
import { getRoleShapeActions, reshapeArcStop, } from '../domain/arc/reshapeArcStop';
import { scoreArcAssembly } from '../domain/arc/scoreArcAssembly';
import { swapArcStop } from '../domain/arc/swapArcStop';
import { inverseRoleProjection, roleProjection } from '../domain/config/roleProjection';
import { getRoleContract } from '../domain/contracts/getRoleContract';
import { getDiscoveryCandidates } from '../domain/discovery/getDiscoveryCandidates';
import { deriveLightNearbyExtensions } from '../domain/exploration/deriveLightNearbyExtensions';
import { planExploration } from '../domain/exploration/planExploration';
import { getCrewPolicy } from '../domain/intent/getCrewPolicy';
import { buildExperienceLens } from '../domain/intent/buildExperienceLens';
import { normalizeIntent } from '../domain/intent/normalizeIntent';
import { projectItinerary } from '../domain/itinerary/projectItinerary';
import { normalizeRawPlace } from '../domain/normalize/normalizeRawPlace';
import { getNearbyAlternatives } from '../domain/retrieval/getNearbyAlternatives';
import { scoreVenueFit } from '../domain/retrieval/scoreVenueFit';
import { generatePlanAdjustmentFeedback, } from '../domain/interpretation/adjustment/generatePlanAdjustmentFeedback';
import { runGeneratePlan } from '../domain/runGeneratePlan';
import { searchAnchorVenues } from '../domain/search/searchAnchorVenues';
import { getSourceMode } from '../domain/sources/getSourceMode';
import { proposeLceRepair } from '../domain/lce/lceRepair';
import { SessionStoreProvider, useSessionStore, } from './state/sessionStore';
import { buildDraftDebugSnapshot, buildExploreDebugSnapshot, } from './debug/buildEngineDebugSnapshot';
import { CurateExperiencePage } from '../pages/CurateExperiencePage';
import { GeneratingPage } from '../pages/GeneratingPage';
import { LandingPage } from '../pages/LandingPage';
import { MoodSelectionPage } from '../pages/MoodSelectionPage';
import { PreviewPage } from '../pages/PreviewPage';
import { RevealPage } from '../pages/RevealPage';
import { TicketPage } from '../pages/TicketPage';
import { consumeLiveArtifactExitNotice, } from '../domain/live/liveArtifactSession';
import { getVibeLabel, } from '../domain/types/intent';
import { createId } from '../lib/ids';
const stepProgress = {
    landing: 0,
    curate: 1,
    crew: 1,
    mood: 2,
    preview: 3,
    location: 3,
    how: 4,
    district: 4,
    discovery: 4,
    generating: 4,
    reveal: 4,
    ticket: 4,
};
function buildDiscoveryRoleLookup(discoveryDirections) {
    const roleByVenueId = new Map();
    if (!discoveryDirections || discoveryDirections.length === 0) {
        return roleByVenueId;
    }
    for (const direction of discoveryDirections) {
        for (const group of direction.groups) {
            for (const candidate of group.candidates) {
                if (candidate.role === 'start' ||
                    candidate.role === 'highlight' ||
                    candidate.role === 'windDown') {
                    roleByVenueId.set(candidate.venueId, candidate.role);
                }
            }
        }
    }
    return roleByVenueId;
}
function buildDiscoveryPreferences(selectedVenueIds, discoveryDirections) {
    if (selectedVenueIds.length === 0 ||
        !discoveryDirections ||
        discoveryDirections.length === 0) {
        return undefined;
    }
    const roleByVenueId = buildDiscoveryRoleLookup(discoveryDirections);
    const preferences = selectedVenueIds
        .map((venueId) => {
        const role = roleByVenueId.get(venueId);
        return role ? { venueId, role } : undefined;
    })
        .filter((value) => Boolean(value));
    return preferences.length > 0 ? preferences : undefined;
}
function buildPlanAnchor(mode, selectedVenueIds, discoveryDirections) {
    if (mode !== 'build' || selectedVenueIds.length === 0) {
        return undefined;
    }
    const roleByVenueId = buildDiscoveryRoleLookup(discoveryDirections);
    const highlightedSelection = selectedVenueIds.find((venueId) => roleByVenueId.get(venueId) === 'highlight');
    const venueId = highlightedSelection ?? selectedVenueIds[0];
    return venueId
        ? {
            venueId,
            role: roleByVenueId.get(venueId) ?? 'highlight',
        }
        : undefined;
}
function mapDistanceToleranceToDistanceMode(distanceTolerance, fallback) {
    if (!distanceTolerance) {
        return fallback;
    }
    return distanceTolerance === 'open' ? 'short-drive' : 'nearby';
}
function toPreferredNeighborhoodLabel(value) {
    if (!value) {
        return undefined;
    }
    const normalized = value
        .replace(/\s+area$/i, '')
        .replace(/\s+district$/i, '')
        .trim();
    return normalized.length > 0 ? normalized : undefined;
}
function applyPreviewControlsToInput(input, previewControls, preferredDistrictNeighborhood) {
    const nextRefinementModes = [...new Set(input.refinementModes ?? [])];
    const removeRefinement = (mode) => {
        const index = nextRefinementModes.indexOf(mode);
        if (index >= 0) {
            nextRefinementModes.splice(index, 1);
        }
    };
    if (previewControls.distanceTolerance === 'compact') {
        if (!nextRefinementModes.includes('closer-by')) {
            nextRefinementModes.push('closer-by');
        }
    }
    else if (previewControls.distanceTolerance === 'balanced') {
        removeRefinement('closer-by');
    }
    else if (previewControls.distanceTolerance === 'open') {
        removeRefinement('closer-by');
    }
    if (previewControls.energyBias === 'softer') {
        removeRefinement('more-exciting');
        if (!nextRefinementModes.includes('more-relaxed')) {
            nextRefinementModes.push('more-relaxed');
        }
    }
    else if (previewControls.energyBias === 'stronger') {
        removeRefinement('more-relaxed');
        if (!nextRefinementModes.includes('more-exciting')) {
            nextRefinementModes.push('more-exciting');
        }
    }
    else if (previewControls.energyBias === 'balanced') {
        removeRefinement('more-relaxed');
        removeRefinement('more-exciting');
    }
    return {
        ...input,
        district: previewControls.districtPreference ?? input.district,
        startTime: previewControls.startTime ?? input.startTime,
        neighborhood: previewControls.districtPreference
            ? preferredDistrictNeighborhood ?? input.neighborhood
            : previewControls.distanceTolerance === 'open'
                ? undefined
                : input.neighborhood,
        distanceMode: mapDistanceToleranceToDistanceMode(previewControls.distanceTolerance, input.distanceMode),
        refinementModes: nextRefinementModes,
    };
}
function buildDraftGenerationInput(state, selectedPack) {
    const persona = state.intentDraft.persona;
    const primaryVibe = state.intentDraft.primaryVibe ?? selectedPack?.primaryAnchor ?? null;
    const secondaryVibe = state.intentDraft.secondaryVibe ?? selectedPack?.secondaryAnchors?.[0];
    const mode = state.mode ?? 'build';
    const discoveryPreferences = buildDiscoveryPreferences(state.selectedDiscoveryVenueIds, state.discoveryGroups);
    const discoveryAnchor = buildPlanAnchor(mode, state.selectedDiscoveryVenueIds, state.discoveryGroups);
    const anchor = state.intentDraft.anchor ?? discoveryAnchor;
    const planningMode = state.intentDraft.planningMode ?? (anchor ? 'user-led' : 'engine-led');
    const draftInput = {
        mode,
        planningMode,
        anchor,
        persona,
        primaryVibe,
        secondaryVibe,
        city: state.intentDraft.city,
        district: state.intentDraft.district,
        neighborhood: state.intentDraft.neighborhood,
        distanceMode: selectedPack?.distanceMode ?? state.intentDraft.distanceMode,
        budget: state.intentDraft.budget,
        startTime: state.intentDraft.startTime || undefined,
        prefersHiddenGems: state.intentDraft.prefersHiddenGems ||
            mode === 'surprise' ||
            selectedPack?.lensPreset?.discoveryBias === 'high',
        refinementModes: [...new Set(state.selectedRefinements)],
        discoveryPreferences,
    };
    const preferredDistrictNeighborhood = toPreferredNeighborhoodLabel(state.generationTrace?.recommendedDistricts.find((district) => district.districtId === state.previewControls.districtPreference)?.label);
    return applyPreviewControlsToInput(draftInput, state.previewControls, preferredDistrictNeighborhood);
}
function buildRefinementInput(state, modes, selectedPack) {
    const persona = state.intentDraft.persona ?? state.lastIntentProfile?.persona ?? null;
    const primaryVibe = state.intentDraft.primaryVibe ??
        selectedPack?.primaryAnchor ??
        state.lastIntentProfile?.primaryAnchor ??
        null;
    const secondaryVibe = state.intentDraft.secondaryVibe ??
        selectedPack?.secondaryAnchors?.[0] ??
        state.lastIntentProfile?.secondaryAnchors?.[0];
    const mode = state.mode ?? state.lastIntentProfile?.mode ?? 'build';
    const discoveryPreferences = buildDiscoveryPreferences(state.selectedDiscoveryVenueIds, state.discoveryGroups);
    const discoveryAnchor = buildPlanAnchor(mode, state.selectedDiscoveryVenueIds, state.discoveryGroups);
    const anchor = state.intentDraft.anchor ?? discoveryAnchor ?? state.lastIntentProfile?.anchor;
    const planningMode = state.intentDraft.planningMode ??
        (anchor ? 'user-led' : state.lastIntentProfile?.planningMode ?? 'engine-led');
    return {
        mode,
        planningMode,
        anchor,
        persona,
        primaryVibe,
        secondaryVibe,
        city: state.intentDraft.city,
        district: state.intentDraft.district ?? state.lastIntentProfile?.district,
        neighborhood: state.intentDraft.neighborhood,
        distanceMode: selectedPack?.distanceMode ?? state.intentDraft.distanceMode,
        budget: state.intentDraft.budget,
        startTime: state.intentDraft.startTime || undefined,
        prefersHiddenGems: state.intentDraft.prefersHiddenGems ||
            mode === 'surprise' ||
            selectedPack?.lensPreset?.discoveryBias === 'high',
        refinementModes: [...new Set(modes)],
        discoveryPreferences,
    };
}
function buildIntentInputFromProfile(intent) {
    return {
        mode: intent.mode,
        persona: intent.persona ?? null,
        primaryVibe: intent.primaryAnchor,
        secondaryVibe: intent.secondaryAnchors?.[0],
        city: intent.city,
        district: intent.district,
        neighborhood: intent.neighborhood,
        distanceMode: intent.distanceMode,
        budget: intent.budget,
        startTime: intent.timeWindow,
        timeWindow: intent.timeWindow,
        prefersHiddenGems: intent.prefersHiddenGems,
        refinementModes: intent.refinementModes,
        planningMode: intent.planningMode,
        anchor: intent.anchor,
        discoveryPreferences: intent.discoveryPreferences,
    };
}
function buildGeneratingCopy(mode, city, district, neighborhood, primaryVibe) {
    const districtLabel = district?.includes('.')
        ? district
            .split('.')
            .slice(-1)[0]
            ?.replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (match) => match.toUpperCase())
        : district;
    const locationLabel = district
        ? `${districtLabel}, ${city}`
        : neighborhood
            ? `${neighborhood}, ${city}`
            : city;
    if (mode === 'surprise') {
        return {
            headline: `Looking for hidden gems around ${locationLabel}...`,
            detail: 'Balancing discovery with a smooth stop-to-stop flow.',
        };
    }
    if (mode === 'curate') {
        return {
            headline: `Turning your starter pack into a route near ${locationLabel}...`,
            detail: 'Selecting strong local options while keeping the path realistic.',
        };
    }
    if (primaryVibe) {
        return {
            headline: `Finding your ${getVibeLabel(primaryVibe)} route nearby...`,
            detail: 'Shaping a stronger finish and a better neighborhood progression.',
        };
    }
    return {
        headline: 'Curating your route...',
        detail: 'Building a coherent plan across high-fit local venues.',
    };
}
function getDebugQueryFlags() {
    if (typeof window === 'undefined') {
        return {
            debugMode: false,
            strictShape: false,
            sourceMode: 'curated',
            sourceModeOverrideApplied: false,
        };
    }
    const params = new URLSearchParams(window.location.search);
    const debugMode = params.get('debug') === '1';
    const strictShape = debugMode && params.get('strictShape') === '1';
    const sourceMode = getSourceMode({
        debugMode,
        search: window.location.search,
    });
    return {
        debugMode,
        strictShape,
        sourceMode: sourceMode.requestedSourceMode,
        sourceModeOverrideApplied: sourceMode.overrideApplied,
    };
}
function applyDiscoveryPreferences({ selectedVenueIds, discoveryGroups, selectedArc, scoredVenues, intent, lens, }) {
    if (selectedVenueIds.length === 0 || !discoveryGroups || discoveryGroups.length === 0) {
        return undefined;
    }
    const roleByVenueId = new Map();
    for (const direction of discoveryGroups) {
        for (const group of direction.groups) {
            for (const candidate of group.candidates) {
                roleByVenueId.set(candidate.venueId, candidate.role);
            }
        }
    }
    const crewPolicy = getCrewPolicy(intent.crew);
    let nextArc = selectedArc;
    let changed = false;
    for (const venueId of selectedVenueIds) {
        const preferredRole = roleByVenueId.get(venueId);
        const replacement = scoredVenues.find((item) => item.venue.id === venueId);
        if (!preferredRole || !replacement) {
            continue;
        }
        if (nextArc.stops.some((stop) => stop.scoredVenue.venue.id === venueId)) {
            continue;
        }
        const swapped = swapArcStop({
            currentArc: nextArc,
            role: inverseRoleProjection[preferredRole],
            replacement,
            intent,
            crewPolicy,
            lens,
        });
        if (!swapped) {
            continue;
        }
        nextArc = swapped;
        changed = true;
    }
    return changed ? nextArc : undefined;
}
function matchesDraftComposeQuery(venue, query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) {
        return false;
    }
    return [
        venue.name,
        venue.neighborhood,
        venue.category,
        venue.subcategory,
        venue.shortDescription,
        ...venue.tags,
    ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
}
function buildComposeSubtitle(venue) {
    return `${venue.neighborhood} | ${venue.driveMinutes} min | ${venue.category.replace('_', ' ')}`;
}
function buildComposeRationale(candidate, targetRole, kind) {
    if (kind === 'custom') {
        return 'Private stop';
    }
    if (candidate.fitBreakdown.proximityFit >= 0.72) {
        return 'Keeps the route tight';
    }
    if (targetRole === 'wildcard' && candidate.hiddenGemScore >= 0.62) {
        return 'Adds variety';
    }
    if (candidate.roleScores[targetRole] >= 0.72) {
        return 'Strong role fit';
    }
    if (candidate.lensCompatibility >= 0.65) {
        return 'Matches the vibe';
    }
    return 'Fits this route';
}
function slugCustomStopPart(value) {
    return (value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24);
}
function buildStableCustomStopId(name, city, neighborhood) {
    const label = slugCustomStopPart(name) || 'custom-stop';
    const cityPart = slugCustomStopPart(city) || 'city';
    const neighborhoodPart = slugCustomStopPart(neighborhood) || 'local';
    return `custom_stop_${cityPart}_${neighborhoodPart}_${label}`;
}
function buildCustomDraftVenue({ name, city, neighborhood, role, templateVenue, }) {
    const baseTemplate = templateVenue;
    const stableId = buildStableCustomStopId(name, city, neighborhood ?? templateVenue?.neighborhood);
    if (templateVenue) {
        return {
            ...templateVenue,
            id: stableId,
            name,
            city,
            neighborhood: neighborhood ?? templateVenue.neighborhood,
            imageUrl: templateVenue.imageUrl ?? '',
            shortDescription: `${name} was added manually to this draft.`,
            narrativeFlavor: `${name} is a custom stop added directly into the route.`,
            source: {
                ...templateVenue.source,
                provider: undefined,
                providerRecordId: undefined,
                sourceOrigin: 'live',
                sourceQueryLabel: 'draft-compose-custom',
                sourceConfidence: Math.max(templateVenue.source.sourceConfidence, 0.58),
            },
        };
    }
    const defaultCategoryByRole = {
        warmup: 'cafe',
        peak: 'restaurant',
        wildcard: 'activity',
        cooldown: 'dessert',
    };
    const rawPlace = {
        rawType: 'place',
        id: stableId,
        name,
        city,
        neighborhood: neighborhood ?? baseTemplate?.neighborhood ?? city,
        driveMinutes: baseTemplate?.driveMinutes ?? (role === 'wildcard' ? 12 : 10),
        priceTier: baseTemplate?.priceTier ?? '$$',
        tags: [...new Set([...(baseTemplate?.tags ?? []), 'custom', 'manual'])].slice(0, 10),
        shortDescription: `${name} was added manually to this draft.`,
        narrativeFlavor: `${name} is a custom stop added directly into the route.`,
        imageUrl: baseTemplate?.imageUrl ?? '',
        categoryHint: baseTemplate?.category ?? defaultCategoryByRole[role],
        subcategoryHint: baseTemplate?.subcategory ?? 'custom stop',
        normalizedFromRawType: 'raw-place',
        sourceOrigin: 'live',
        sourceQueryLabel: 'draft-compose-custom',
        sourceConfidence: 0.55,
        queryTerms: [name],
    };
    return normalizeRawPlace(rawPlace);
}
function reconcileUserComposedStopsByArc(userComposedStopsByRole, arc) {
    const composedByVenueId = new Map(Object.values(userComposedStopsByRole).map((item) => [item.venue.id, item]));
    return arc.stops.reduce((nextStops, stop) => {
        const existing = composedByVenueId.get(stop.scoredVenue.venue.id);
        if (!existing) {
            return nextStops;
        }
        const nextRole = roleProjection[stop.role];
        nextStops[nextRole] = {
            ...existing,
            role: nextRole,
            label: stop.scoredVenue.venue.name,
            venue: stop.scoredVenue.venue,
        };
        return nextStops;
    }, {});
}
function buildUserComposedConflictMessage(failedStops) {
    if (failedStops.length === 0) {
        return undefined;
    }
    const labels = failedStops.map((stop) => stop.label).join(', ');
    return `Could not keep ${labels} in the updated route because the new plan context created a hard fit conflict.`;
}
function buildAuthoredRouteConflictMessage() {
    return 'Could not fully preserve your edited route shape because the updated plan context created a hard fit conflict.';
}
function normalizeModeSet(values) {
    if (!values || values.length === 0) {
        return '';
    }
    return [...new Set(values)].sort((left, right) => left.localeCompare(right)).join('|');
}
function AppShellContent({ environment }) {
    const { state, actions } = useSessionStore();
    const [landingNotice, setLandingNotice] = useState(null);
    const [lceRepairProposal, setLceRepairProposal] = useState();
    const [lceBrokenByRole, setLceBrokenByRole] = useState({});
    const [lceSystemMessage, setLceSystemMessage] = useState();
    const [lceTraceNote, setLceTraceNote] = useState();
    const [planAdjustmentFeedback, setPlanAdjustmentFeedback] = useState();
    const [pendingPlanAdjustment, setPendingPlanAdjustment] = useState();
    const activeStarterPack = useMemo(() => starterPacks.find((pack) => pack.id === state.selectedStarterPackId), [state.selectedStarterPackId]);
    const queryDebugFlags = getDebugQueryFlags();
    const debugFlags = environment === 'dev'
        ? {
            ...queryDebugFlags,
            debugMode: true,
        }
        : queryDebugFlags;
    const effectiveDraftInput = useMemo(() => buildDraftGenerationInput(state, activeStarterPack), [
        activeStarterPack,
        state.discoveryGroups,
        state.intentDraft,
        state.mode,
        state.previewControls,
        state.selectedDiscoveryVenueIds,
        state.selectedRefinements,
    ]);
    const previewDirty = Boolean(state.generatedItinerary) &&
        Boolean(state.lastIntentProfile) &&
        ((effectiveDraftInput.district ?? '') !== (state.lastIntentProfile?.district ?? '') ||
            (effectiveDraftInput.neighborhood ?? '') !== (state.lastIntentProfile?.neighborhood ?? '') ||
            (effectiveDraftInput.startTime ?? '') !== (state.lastIntentProfile?.timeWindow ?? '') ||
            effectiveDraftInput.distanceMode !== state.lastIntentProfile?.distanceMode ||
            (effectiveDraftInput.budget ?? '') !== (state.lastIntentProfile?.budget ?? '') ||
            normalizeModeSet(effectiveDraftInput.refinementModes) !==
                normalizeModeSet(state.lastIntentProfile?.refinementModes));
    const exploreIntentProfile = useMemo(() => {
        if (!state.intentDraft.primaryVibe) {
            return undefined;
        }
        return normalizeIntent(effectiveDraftInput);
    }, [
        effectiveDraftInput,
    ]);
    const exploreLens = useMemo(() => {
        if (!exploreIntentProfile) {
            return undefined;
        }
        return buildExperienceLens({
            intent: exploreIntentProfile,
            starterPack: activeStarterPack,
            strictShape: debugFlags.strictShape,
        });
    }, [activeStarterPack, debugFlags.strictShape, exploreIntentProfile]);
    const exploreDebugSnapshot = useMemo(() => {
        if (!debugFlags.debugMode) {
            return undefined;
        }
        return buildExploreDebugSnapshot({
            intentDraft: state.intentDraft,
            intentProfile: exploreIntentProfile,
            lens: exploreLens,
            discoveryGroups: state.discoveryGroups,
            selectedVenueIds: state.selectedDiscoveryVenueIds,
            anchorName: state.selectedAnchorVenue?.name,
        });
    }, [
        debugFlags.debugMode,
        exploreIntentProfile,
        exploreLens,
        state.discoveryGroups,
        state.intentDraft,
        state.selectedAnchorVenue?.name,
        state.selectedDiscoveryVenueIds,
        state.previewControls,
        state.selectedRefinements,
    ]);
    const draftDebugSnapshot = useMemo(() => {
        if (!debugFlags.debugMode ||
            !state.generatedItinerary ||
            !state.generatedArc ||
            !state.lastIntentProfile ||
            !state.experienceLens ||
            !state.generationTrace ||
            !state.scoredVenues) {
            return undefined;
        }
        return buildDraftDebugSnapshot({
            itinerary: state.generatedItinerary,
            arc: state.generatedArc,
            scoredVenues: state.scoredVenues ?? [],
            intentProfile: state.lastIntentProfile,
            lens: state.experienceLens,
            generationTrace: state.generationTrace,
            discoveryGroups: state.discoveryGroups,
            selectedVenueIds: state.selectedDiscoveryVenueIds,
            anchorName: state.selectedAnchorVenue?.name,
        });
    }, [
        debugFlags.debugMode,
        state.discoveryGroups,
        state.experienceLens,
        state.generatedArc,
        state.generatedItinerary,
        state.generationTrace,
        state.lastIntentProfile,
        state.scoredVenues,
        state.selectedAnchorVenue?.name,
        state.selectedDiscoveryVenueIds,
    ]);
    useEffect(() => {
        setLandingNotice(consumeLiveArtifactExitNotice());
    }, []);
    const handleAnchorSelect = (venue) => {
        actions.clearDistrictPreview();
        actions.clearDiscoveryPreview();
        actions.setDiscoverySelection([]);
        actions.setSelectedAnchorVenue(venue);
        actions.patchIntentDraft({
            planningMode: 'user-led',
            anchor: {
                venueId: venue.id,
                role: 'highlight',
            },
        });
    };
    useEffect(() => {
        if (state.currentStep !== 'generating') {
            return;
        }
        const generationTarget = state.generationTarget;
        const selectedPack = starterPacks.find((pack) => pack.id === state.selectedStarterPackId);
        const input = effectiveDraftInput;
        let cancelled = false;
        const timeoutHandle = window.setTimeout(() => {
            void (async () => {
                try {
                    const result = await runGeneratePlan(input, {
                        starterPack: selectedPack,
                        debugMode: debugFlags.debugMode,
                        strictShape: debugFlags.strictShape,
                        sourceMode: debugFlags.sourceMode,
                        sourceModeOverrideApplied: debugFlags.sourceModeOverrideApplied,
                        seedVenues: state.selectedAnchorVenue ? [state.selectedAnchorVenue] : undefined,
                    });
                    if (cancelled) {
                        return;
                    }
                    const discoveryPreferredArc = applyDiscoveryPreferences({
                        selectedVenueIds: state.selectedDiscoveryVenueIds,
                        discoveryGroups: state.discoveryGroups,
                        selectedArc: result.selectedArc,
                        scoredVenues: result.scoredVenues,
                        intent: result.intentProfile,
                        lens: result.lens,
                    });
                    const preferredArc = discoveryPreferredArc ?? result.selectedArc;
                    const persistedAuthoredRoute = applyPersistedAuthoredRoute({
                        arc: preferredArc,
                        scoredVenues: result.scoredVenues,
                        intentProfile: result.intentProfile,
                        lens: result.lens,
                    });
                    const preferredItinerary = persistedAuthoredRoute.arc.id !== result.selectedArc.id
                        ? projectItinerary(persistedAuthoredRoute.arc, result.intentProfile, result.lens)
                        : result.itinerary;
                    if (generationTarget === 'preview') {
                        if (pendingPlanAdjustment) {
                            setPlanAdjustmentFeedback(generatePlanAdjustmentFeedback({
                                previousPlan: pendingPlanAdjustment.previousPlan,
                                nextPlan: {
                                    itinerary: preferredItinerary,
                                    trace: result.trace,
                                },
                                controls: pendingPlanAdjustment.controls,
                            }));
                        }
                        else {
                            setPlanAdjustmentFeedback(undefined);
                        }
                        setPendingPlanAdjustment(undefined);
                    }
                    actions.setGeneration(result.itinerary, result.selectedArc, persistedAuthoredRoute.scoredVenues, result.intentProfile, result.lens, result.trace);
                    actions.setUserComposedStops(persistedAuthoredRoute.userComposedStopsByRole);
                    actions.setRouteEditedByUser(persistedAuthoredRoute.routeEditedByUser);
                    actions.setCompositionConflictMessage(persistedAuthoredRoute.compositionConflictMessage);
                    if (persistedAuthoredRoute.arc.id !== result.selectedArc.id) {
                        actions.setArcAndItinerary(preferredItinerary, persistedAuthoredRoute.arc);
                    }
                    actions.setStep(generationTarget === 'preview' ? 'preview' : 'reveal');
                }
                catch (error) {
                    console.error(error);
                    if (!cancelled) {
                        setPendingPlanAdjustment(undefined);
                        actions.setStep(generationTarget === 'preview' ? 'mood' : 'preview');
                    }
                }
            })();
        }, 650);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutHandle);
        };
    }, [
        actions,
        effectiveDraftInput,
        state.currentStep,
        state.generationTarget,
        state.discoveryGroups,
        state.selectedDiscoveryVenueIds,
        state.selectedAnchorVenue,
        state.selectedStarterPackId,
        pendingPlanAdjustment,
    ]);
    const progress = stepProgress[state.currentStep];
    const environmentLabel = environment === 'dev'
        ? 'Development Sandbox'
        : environment === 'archive'
            ? 'Previous flow — for reference'
            : null;
    const generatingCopy = buildGeneratingCopy(state.mode, state.intentDraft.city, state.previewControls.districtPreference ?? state.intentDraft.district, state.previewControls.distanceTolerance === 'open'
        ? undefined
        : state.intentDraft.neighborhood, state.intentDraft.primaryVibe);
    const lightNearbyExtensions = state.generatedArc && state.scoredVenues && state.lastIntentProfile && state.experienceLens
        ? deriveLightNearbyExtensions({
            currentArc: state.generatedArc,
            scoredVenues: state.scoredVenues,
            intent: state.lastIntentProfile,
            lens: state.experienceLens,
        })
        : [];
    const previewAdjustDisabledRoles = state.lastIntentProfile?.planningMode === 'user-led' && state.lastIntentProfile.anchor?.role
        ? [state.lastIntentProfile.anchor.role]
        : [];
    const previewAdjustLockedNotesByRole = state.lastIntentProfile?.anchor?.role
        ? {
            [state.lastIntentProfile.anchor.role]: 'This stop anchors your plan.',
        }
        : {};
    const previewOwnedStopKindsByRole = useMemo(() => Object.entries(state.userComposedStopsByRole).reduce((ownedStops, [role, stop]) => {
        ownedStops[role] = stop.kind;
        return ownedStops;
    }, {}), [state.userComposedStopsByRole]);
    const previewRoleShapeActionsByRole = useMemo(() => {
        if (!state.generatedArc || !state.lastIntentProfile || !state.experienceLens) {
            return {};
        }
        const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew);
        return state.generatedArc.stops.reduce((actionsByRole, stop) => {
            const userRole = roleProjection[stop.role];
            actionsByRole[userRole] = getRoleShapeActions({
                currentArc: state.generatedArc,
                role: userRole,
                intent: state.lastIntentProfile,
                crewPolicy,
                lens: state.experienceLens,
            });
            return actionsByRole;
        }, {});
    }, [state.experienceLens, state.generatedArc, state.lastIntentProfile]);
    const previewComposeActionsByRole = useMemo(() => {
        if (!state.generatedArc ||
            !state.scoredVenues ||
            !state.lastIntentProfile ||
            !state.experienceLens) {
            return {};
        }
        const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew);
        return state.generatedArc.stops.reduce((actionsByRole, stop) => {
            const userRole = roleProjection[stop.role];
            actionsByRole[userRole] = getDraftComposeActions({
                currentArc: state.generatedArc,
                role: userRole,
                scoredVenues: state.scoredVenues,
                intent: state.lastIntentProfile,
                crewPolicy,
                lens: state.experienceLens,
            });
            return actionsByRole;
        }, {});
    }, [
        state.experienceLens,
        state.generatedArc,
        state.lastIntentProfile,
        state.scoredVenues,
    ]);
    const buildMergedPersistedScoredVenueMap = ({ scoredVenues, authoredArc, intentProfile, lens, }) => {
        const crewPolicy = getCrewPolicy(intentProfile.crew);
        const roleContracts = getRoleContract({
            intent: intentProfile,
            starterPack: activeStarterPack,
        });
        const mergedScoredVenueMap = new Map(scoredVenues.map((item) => [item.venue.id, item]));
        const persistedVenues = [
            ...(authoredArc?.stops.map((stop) => stop.scoredVenue.venue) ?? []),
            ...Object.values(state.userComposedStopsByRole).map((stop) => stop.venue),
        ];
        for (const venue of persistedVenues) {
            if (mergedScoredVenueMap.has(venue.id)) {
                continue;
            }
            mergedScoredVenueMap.set(venue.id, scoreVenueFit(venue, intentProfile, crewPolicy, lens, roleContracts, activeStarterPack));
        }
        return {
            crewPolicy,
            mergedScoredVenueMap,
        };
    };
    const rehydrateAuthoredArc = ({ authoredArc, scoredVenueMap, intentProfile, lens, crewPolicy, }) => {
        const nextStops = authoredArc.stops.map((stop) => {
            const scoredVenue = scoredVenueMap.get(stop.scoredVenue.venue.id);
            return scoredVenue
                ? {
                    role: stop.role,
                    scoredVenue,
                }
                : undefined;
        });
        if (nextStops.some((stop) => !stop)) {
            return undefined;
        }
        const hydratedStops = nextStops.filter((stop) => Boolean(stop));
        if (!isValidArcCombination(hydratedStops, intentProfile, crewPolicy, lens)) {
            return undefined;
        }
        const rescored = scoreArcAssembly(hydratedStops, intentProfile, crewPolicy, lens);
        return {
            id: authoredArc.id,
            stops: hydratedStops,
            totalScore: rescored.totalScore,
            scoreBreakdown: rescored.scoreBreakdown,
            pacing: rescored.pacing,
            spatial: rescored.spatial,
            hasWildcard: hydratedStops.some((stop) => stop.role === 'wildcard'),
        };
    };
    const applyPersistedComposedStops = ({ arc, scoredVenues, intentProfile, lens, }) => {
        if (Object.keys(state.userComposedStopsByRole).length === 0) {
            return {
                arc,
                scoredVenues,
                userComposedStopsByRole: state.userComposedStopsByRole,
                compositionConflictMessage: undefined,
            };
        }
        const { crewPolicy, mergedScoredVenueMap } = buildMergedPersistedScoredVenueMap({
            scoredVenues,
            intentProfile,
            lens,
        });
        let nextArc = arc;
        const failedStops = [];
        for (const role of ['start', 'highlight', 'surprise', 'windDown']) {
            const composedStop = state.userComposedStopsByRole[role];
            if (!composedStop) {
                continue;
            }
            const scoredVenue = mergedScoredVenueMap.get(composedStop.venue.id);
            if (!scoredVenue) {
                failedStops.push(composedStop);
                continue;
            }
            const currentArcRole = nextArc.stops.find((stop) => stop.scoredVenue.venue.id === composedStop.venue.id)?.role;
            const reappliedArc = currentArcRole && roleProjection[currentArcRole] !== role
                ? reshapeArcStop({
                    currentArc: nextArc,
                    role: currentArcRole,
                    targetRole: inverseRoleProjection[role],
                    intent: intentProfile,
                    crewPolicy,
                    lens,
                })
                : role === 'surprise'
                    ? nextArc.hasWildcard
                        ? swapArcStop({
                            currentArc: nextArc,
                            role: 'wildcard',
                            replacement: scoredVenue,
                            intent: intentProfile,
                            crewPolicy,
                            lens,
                        })
                        : insertArcStop({
                            currentArc: nextArc,
                            role: 'peak',
                            actionId: 'add-after',
                            inserted: scoredVenue,
                            intent: intentProfile,
                            crewPolicy,
                            lens,
                        })
                    : swapArcStop({
                        currentArc: nextArc,
                        role: inverseRoleProjection[role],
                        replacement: scoredVenue,
                        intent: intentProfile,
                        crewPolicy,
                        lens,
                    });
            if (!reappliedArc) {
                failedStops.push(composedStop);
                continue;
            }
            nextArc = reappliedArc;
        }
        return {
            arc: nextArc,
            scoredVenues: [...mergedScoredVenueMap.values()],
            userComposedStopsByRole: reconcileUserComposedStopsByArc(state.userComposedStopsByRole, nextArc),
            compositionConflictMessage: buildUserComposedConflictMessage(failedStops),
        };
    };
    const applyPersistedAuthoredRoute = ({ arc, scoredVenues, intentProfile, lens, }) => {
        const authoredArc = state.routeEditedByUser ? state.generatedArc : undefined;
        if (!authoredArc) {
            return {
                arc,
                scoredVenues,
                userComposedStopsByRole: state.userComposedStopsByRole,
                compositionConflictMessage: undefined,
                routeEditedByUser: false,
            };
        }
        const { crewPolicy, mergedScoredVenueMap } = buildMergedPersistedScoredVenueMap({
            scoredVenues,
            authoredArc,
            intentProfile,
            lens,
        });
        const exactAuthoredArc = rehydrateAuthoredArc({
            authoredArc,
            scoredVenueMap: mergedScoredVenueMap,
            intentProfile,
            lens,
            crewPolicy,
        });
        if (exactAuthoredArc) {
            return {
                arc: exactAuthoredArc,
                scoredVenues: [...mergedScoredVenueMap.values()],
                userComposedStopsByRole: reconcileUserComposedStopsByArc(state.userComposedStopsByRole, exactAuthoredArc),
                compositionConflictMessage: undefined,
                routeEditedByUser: true,
            };
        }
        const fallback = applyPersistedComposedStops({
            arc,
            scoredVenues: [...mergedScoredVenueMap.values()],
            intentProfile,
            lens,
        });
        return {
            ...fallback,
            compositionConflictMessage: fallback.compositionConflictMessage ?? buildAuthoredRouteConflictMessage(),
            routeEditedByUser: true,
        };
    };
    const commitDraftArcUpdate = (nextArc, nextUserComposedStopsByRole = reconcileUserComposedStopsByArc(state.userComposedStopsByRole, nextArc), compositionConflictMessage) => {
        if (!state.lastIntentProfile || !state.experienceLens) {
            return;
        }
        const itinerary = projectItinerary(nextArc, state.lastIntentProfile, state.experienceLens);
        actions.setArcAndItinerary(itinerary, nextArc);
        actions.setUserComposedStops(nextUserComposedStopsByRole);
        actions.setRouteEditedByUser(true);
        actions.setCompositionConflictMessage(compositionConflictMessage);
        setLceRepairProposal(undefined);
        setLceBrokenByRole({});
        setLceSystemMessage(undefined);
    };
    const handleProposeLceRepair = (role, trigger) => {
        if (!state.generatedArc || !state.scoredVenues || !state.lastIntentProfile || !state.experienceLens) {
            return false;
        }
        const brokenStop = state.generatedArc.stops.find((stop) => roleProjection[stop.role] === role);
        if (!brokenStop) {
            return false;
        }
        const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew);
        const rolePoolAlternatives = state.alternativeKindsByRole[role] === 'swap' ? state.alternativesByRole[role] : undefined;
        const proposal = proposeLceRepair({
            currentArc: state.generatedArc,
            role,
            trigger,
            scoredVenues: state.scoredVenues,
            intent: state.lastIntentProfile,
            crewPolicy,
            lens: state.experienceLens,
            rolePoolAlternatives,
        });
        setLceBrokenByRole((current) => ({
            ...current,
            [role]: trigger,
        }));
        setLceSystemMessage(undefined);
        if (!proposal) {
            setLceRepairProposal(undefined);
            setLceTraceNote(`broken: ${brokenStop.scoredVenue.venue.name} | role: ${role} | replacement: none | source: existing pool`);
            return true;
        }
        setLceRepairProposal(proposal);
        setLceTraceNote(`broken: ${proposal.brokenStopVenueName} | role: ${proposal.role} | replacement: ${proposal.replacement.venue.name} | source: ${proposal.source} | pending`);
        return true;
    };
    const handleApplyLceRepairProposal = () => {
        if (!lceRepairProposal) {
            return;
        }
        commitDraftArcUpdate(lceRepairProposal.proposedArc);
        setLceSystemMessage('Adjusted for availability.');
        setLceTraceNote(`broken: ${lceRepairProposal.brokenStopVenueName} | role: ${lceRepairProposal.role} | replacement: ${lceRepairProposal.replacement.venue.name} | source: ${lceRepairProposal.source} | applied`);
    };
    const handleKeepCurrentPlanAfterLce = () => {
        if (!lceRepairProposal) {
            return;
        }
        setLceTraceNote(`broken: ${lceRepairProposal.brokenStopVenueName} | role: ${lceRepairProposal.role} | replacement: ${lceRepairProposal.replacement.venue.name} | source: ${lceRepairProposal.source} | declined`);
        setLceRepairProposal(undefined);
        setLceSystemMessage(undefined);
    };
    const handleRefreshExplorePreview = async () => {
        const selectedPack = starterPacks.find((pack) => pack.id === state.selectedStarterPackId);
        const input = buildDraftGenerationInput(state, selectedPack);
        const debugFlags = getDebugQueryFlags();
        actions.beginDiscoveryPreview();
        try {
            const groups = await getDiscoveryCandidates(input, {
                starterPack: selectedPack,
                strictShape: debugFlags.strictShape,
                sourceMode: debugFlags.sourceMode,
                sourceModeOverrideApplied: debugFlags.sourceModeOverrideApplied,
            });
            actions.setDiscoveryPreview(groups);
        }
        catch (error) {
            console.error(error);
            actions.clearDiscoveryPreview();
        }
    };
    useEffect(() => {
        if (state.currentStep !== 'mood') {
            return;
        }
        if (!state.intentDraft.primaryVibe) {
            actions.clearDiscoveryPreview();
            return;
        }
        let cancelled = false;
        const timeoutHandle = window.setTimeout(() => {
            void (async () => {
                try {
                    await handleRefreshExplorePreview();
                }
                catch (error) {
                    if (!cancelled) {
                        console.error(error);
                    }
                }
            })();
        }, 260);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutHandle);
        };
    }, [
        actions,
        state.currentStep,
        state.intentDraft.city,
        state.intentDraft.neighborhood,
        state.intentDraft.persona,
        state.intentDraft.primaryVibe,
        state.intentDraft.secondaryVibe,
        state.mode,
        state.selectedStarterPackId,
    ]);
    const handleShowSwap = (role) => {
        if (!state.generatedArc || !state.scoredVenues || !state.lastIntentProfile || !state.experienceLens) {
            return;
        }
        const internalRole = inverseRoleProjection[role];
        if (internalRole === 'wildcard' && !state.generatedArc.hasWildcard) {
            actions.setStopAlternatives(role, [], 'swap');
            return;
        }
        const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew);
        const alternatives = getRoleAlternatives({
            role: internalRole,
            currentArc: state.generatedArc,
            scoredVenues: state.scoredVenues,
            intent: state.lastIntentProfile,
            crewPolicy,
            lens: state.experienceLens,
            limit: 5,
        });
        actions.setStopAlternatives(role, alternatives, 'swap');
        actions.setTraceAlternativeCount(role, alternatives.length, 'swap');
    };
    const handleShowNearby = (role) => {
        if (!state.generatedArc || !state.scoredVenues || !state.lastIntentProfile || !state.experienceLens) {
            return;
        }
        const internalRole = inverseRoleProjection[role];
        if (internalRole === 'wildcard' && !state.generatedArc.hasWildcard) {
            actions.setStopAlternatives(role, [], 'nearby');
            return;
        }
        const alternatives = getNearbyAlternatives({
            role: internalRole,
            currentArc: state.generatedArc,
            scoredVenues: state.scoredVenues,
            intent: state.lastIntentProfile,
            lens: state.experienceLens,
            limit: 4,
        });
        actions.setStopAlternatives(role, alternatives, 'nearby');
        actions.setTraceAlternativeCount(role, alternatives.length, 'nearby');
    };
    const handleApplySwap = (role, venueId) => {
        if (!state.generatedArc || !state.scoredVenues || !state.lastIntentProfile || !state.experienceLens) {
            return;
        }
        const replacement = state.scoredVenues.find((item) => item.venue.id === venueId);
        if (!replacement) {
            return;
        }
        const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew);
        const swapped = swapArcStop({
            currentArc: state.generatedArc,
            role: inverseRoleProjection[role],
            replacement,
            intent: state.lastIntentProfile,
            crewPolicy,
            lens: state.experienceLens,
        });
        if (!swapped) {
            return;
        }
        commitDraftArcUpdate(swapped);
        const internalRole = inverseRoleProjection[role];
        const visibleKind = state.alternativeKindsByRole[role] ?? 'swap';
        const refreshedAlternatives = visibleKind === 'nearby'
            ? getNearbyAlternatives({
                role: internalRole,
                currentArc: swapped,
                scoredVenues: state.scoredVenues,
                intent: state.lastIntentProfile,
                lens: state.experienceLens,
                limit: 4,
            })
            : getRoleAlternatives({
                role: internalRole,
                currentArc: swapped,
                scoredVenues: state.scoredVenues,
                intent: state.lastIntentProfile,
                crewPolicy,
                lens: state.experienceLens,
                limit: 5,
            });
        actions.setStopAlternatives(role, refreshedAlternatives, visibleKind);
        actions.setTraceAlternativeCount(role, refreshedAlternatives.length, visibleKind);
    };
    const handleApplyRoleShape = (role, actionId) => {
        if (!state.generatedArc || !state.lastIntentProfile || !state.experienceLens) {
            return false;
        }
        const action = previewRoleShapeActionsByRole[role]?.find((item) => item.id === actionId);
        if (!action) {
            return false;
        }
        const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew);
        const reshaped = reshapeArcStop({
            currentArc: state.generatedArc,
            role: inverseRoleProjection[role],
            targetRole: inverseRoleProjection[action.targetRole],
            intent: state.lastIntentProfile,
            crewPolicy,
            lens: state.experienceLens,
        });
        if (!reshaped) {
            return false;
        }
        commitDraftArcUpdate(reshaped);
        return true;
    };
    const handleApplyComposeAction = (role, actionId) => {
        if (actionId !== 'remove-stop' ||
            !state.generatedArc ||
            !state.scoredVenues ||
            !state.lastIntentProfile ||
            !state.experienceLens) {
            return false;
        }
        return handleProposeLceRepair(role, 'removed');
    };
    const handleSearchCompose = async (role, actionId, query) => {
        if (!state.generatedArc ||
            !state.scoredVenues ||
            !state.lastIntentProfile ||
            !state.experienceLens) {
            return [];
        }
        const trimmedQuery = query.trim();
        if (trimmedQuery.length < 2) {
            return [];
        }
        const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew);
        const roleContracts = getRoleContract({
            intent: state.lastIntentProfile,
            starterPack: activeStarterPack,
        });
        const targetRole = getComposeActionTargetRole(role, actionId);
        const currentStop = state.generatedArc.stops.find((stop) => roleProjection[stop.role] === role);
        const localMatches = state.scoredVenues.filter((item) => matchesDraftComposeQuery(item.venue, trimmedQuery));
        const remoteMatches = await searchAnchorVenues({
            query: trimmedQuery,
            city: state.lastIntentProfile.city,
            neighborhood: state.lastIntentProfile.neighborhood ?? currentStop?.scoredVenue.venue.neighborhood,
        }).catch(() => []);
        const scoredRemoteMatches = remoteMatches.map((result) => ({
            scoredVenue: scoreVenueFit(result.venue, state.lastIntentProfile, crewPolicy, state.experienceLens, roleContracts, activeStarterPack),
            subtitle: result.subtitle,
        }));
        const seenIds = new Set();
        const candidateResults = [
            ...localMatches.map((item) => ({
                kind: 'candidate',
                scoredVenue: item,
                subtitle: buildComposeSubtitle(item.venue),
            })),
            ...scoredRemoteMatches.map((item) => ({
                kind: 'candidate',
                scoredVenue: item.scoredVenue,
                subtitle: item.subtitle,
            })),
        ]
            .filter((item) => {
            if (seenIds.has(item.scoredVenue.venue.id)) {
                return false;
            }
            seenIds.add(item.scoredVenue.venue.id);
            return canApplyComposeSearchResult({
                currentArc: state.generatedArc,
                role,
                actionId,
                scoredVenue: item.scoredVenue,
                intent: state.lastIntentProfile,
                crewPolicy,
                lens: state.experienceLens,
            });
        })
            .sort((left, right) => right.scoredVenue.roleScores[targetRole] - left.scoredVenue.roleScores[targetRole] ||
            right.scoredVenue.fitScore - left.scoredVenue.fitScore)
            .slice(0, 3)
            .map((item) => ({
            id: item.scoredVenue.venue.id,
            title: item.scoredVenue.venue.name,
            subtitle: item.subtitle,
            rationale: buildComposeRationale(item.scoredVenue, targetRole, item.kind),
            kind: item.kind,
            scoredVenue: item.scoredVenue,
        }));
        return candidateResults;
    };
    const handleCreateCustomComposeStop = (role, actionId, label) => {
        if (!state.generatedArc ||
            !state.lastIntentProfile ||
            !state.experienceLens ||
            label.trim().length < 2) {
            return false;
        }
        const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew);
        const roleContracts = getRoleContract({
            intent: state.lastIntentProfile,
            starterPack: activeStarterPack,
        });
        const targetRole = getComposeActionTargetRole(role, actionId);
        const currentStop = state.generatedArc.stops.find((stop) => roleProjection[stop.role] === role);
        const customVenue = buildCustomDraftVenue({
            name: label.trim(),
            city: state.lastIntentProfile.city,
            neighborhood: state.lastIntentProfile.neighborhood ?? currentStop?.scoredVenue.venue.neighborhood,
            role: targetRole,
            templateVenue: currentStop?.scoredVenue.venue,
        });
        const customCandidate = scoreVenueFit(customVenue, state.lastIntentProfile, crewPolicy, state.experienceLens, roleContracts, activeStarterPack);
        if (!canApplyComposeSearchResult({
            currentArc: state.generatedArc,
            role,
            actionId,
            scoredVenue: customCandidate,
            intent: state.lastIntentProfile,
            crewPolicy,
            lens: state.experienceLens,
        })) {
            return false;
        }
        return handleApplyComposeSearchResult(role, actionId, {
            id: customCandidate.venue.id,
            title: customCandidate.venue.name,
            subtitle: `${customCandidate.venue.neighborhood} | custom/private stop`,
            rationale: buildComposeRationale(customCandidate, targetRole, 'custom'),
            kind: 'custom',
            scoredVenue: customCandidate,
        });
    };
    const handleApplyComposeSearchResult = (role, actionId, result) => {
        if (!state.generatedArc || !state.lastIntentProfile || !state.experienceLens) {
            return false;
        }
        const crewPolicy = getCrewPolicy(state.lastIntentProfile.crew);
        const nextArc = actionId === 'replace-stop'
            ? swapArcStop({
                currentArc: state.generatedArc,
                role: inverseRoleProjection[role],
                replacement: result.scoredVenue,
                intent: state.lastIntentProfile,
                crewPolicy,
                lens: state.experienceLens,
            })
            : insertArcStop({
                currentArc: state.generatedArc,
                role: inverseRoleProjection[role],
                actionId,
                inserted: result.scoredVenue,
                intent: state.lastIntentProfile,
                crewPolicy,
                lens: state.experienceLens,
            });
        if (!nextArc) {
            return false;
        }
        const nextRole = actionId === 'replace-stop' ? role : 'surprise';
        const nextUserComposedStopsByRole = reconcileUserComposedStopsByArc({
            ...state.userComposedStopsByRole,
            [nextRole]: {
                ownedStopId: result.scoredVenue.venue.id,
                role: nextRole,
                label: result.scoredVenue.venue.name,
                venue: result.scoredVenue.venue,
                kind: result.kind,
                sourceAction: actionId,
            },
        }, nextArc);
        commitDraftArcUpdate(nextArc, nextUserComposedStopsByRole);
        return true;
    };
    const handleApplyRefinement = (modes) => {
        actions.setRefinements(modes);
        if (!state.generatedArc) {
            return;
        }
        void (async () => {
            try {
                const selectedPack = starterPacks.find((pack) => pack.id === state.selectedStarterPackId);
                const input = buildRefinementInput(state, modes, selectedPack);
                const result = await runGeneratePlan(input, {
                    starterPack: selectedPack,
                    baselineArc: state.generatedArc,
                    baselineTrace: state.generationTrace,
                    baselineItineraryId: state.generatedItinerary?.id,
                    debugMode: debugFlags.debugMode,
                    strictShape: debugFlags.strictShape,
                    sourceMode: debugFlags.sourceMode,
                    sourceModeOverrideApplied: debugFlags.sourceModeOverrideApplied,
                    seedVenues: state.selectedAnchorVenue ? [state.selectedAnchorVenue] : undefined,
                });
                const persistedAuthoredRoute = applyPersistedAuthoredRoute({
                    arc: result.selectedArc,
                    scoredVenues: result.scoredVenues,
                    intentProfile: result.intentProfile,
                    lens: result.lens,
                });
                actions.setGeneration(result.itinerary, result.selectedArc, persistedAuthoredRoute.scoredVenues, result.intentProfile, result.lens, result.trace);
                actions.setUserComposedStops(persistedAuthoredRoute.userComposedStopsByRole);
                actions.setRouteEditedByUser(persistedAuthoredRoute.routeEditedByUser);
                actions.setCompositionConflictMessage(persistedAuthoredRoute.compositionConflictMessage);
                if (persistedAuthoredRoute.arc.id !== result.selectedArc.id) {
                    const preferredItinerary = projectItinerary(persistedAuthoredRoute.arc, result.intentProfile, result.lens);
                    actions.setArcAndItinerary(preferredItinerary, persistedAuthoredRoute.arc);
                }
            }
            catch (error) {
                console.error(error);
            }
        })();
    };
    const handleContinueOuting = () => {
        const currentIntentProfile = state.lastIntentProfile;
        if (!currentIntentProfile) {
            return;
        }
        actions.beginExploration();
        void (async () => {
            try {
                const selectedPack = starterPacks.find((pack) => pack.id === state.selectedStarterPackId);
                const input = buildIntentInputFromProfile(currentIntentProfile);
                const plan = await planExploration(input, {
                    starterPack: selectedPack,
                    debugMode: debugFlags.debugMode,
                    strictShape: debugFlags.strictShape,
                    sourceMode: debugFlags.sourceMode,
                    sourceModeOverrideApplied: debugFlags.sourceModeOverrideApplied,
                });
                actions.setExplorationPlan(plan);
            }
            catch (error) {
                console.error(error);
                actions.clearExplorationPlan();
            }
        })();
    };
    return (_jsxs("main", { className: "app-shell", children: [_jsxs("header", { className: "app-topbar", children: [environmentLabel && _jsx("p", { className: "shell-environment-label", children: environmentLabel }), _jsx("p", { className: "brand", children: "ID.8" }), progress > 0 && _jsx(ProgressDots, { total: 4, current: progress })] }), state.currentStep === 'landing' && (_jsx(LandingPage, { notice: landingNotice ?? undefined, onDismissNotice: () => setLandingNotice(null), conciergeHref: environment === 'dev' ? '/dev/concierge' : '/', conciergeLabel: environment === 'dev' ? 'Enter Sandbox Concierge' : 'Open Concierge', onSelectMode: (mode) => {
                    setLandingNotice(null);
                    actions.setMode(mode);
                    actions.clearStopAlternatives();
                    if (mode === 'curate') {
                        actions.setStep('curate');
                        return;
                    }
                    actions.patchIntentDraft({
                        primaryVibe: mode === 'surprise' ? null : state.intentDraft.primaryVibe,
                        district: undefined,
                        prefersHiddenGems: mode === 'surprise',
                    });
                    actions.selectStarterPack(undefined);
                    actions.setStep('mood');
                } })), state.currentStep === 'curate' && (_jsx(CurateExperiencePage, { packs: starterPacks, selectedPackId: state.selectedStarterPackId, onSelectPack: (packId) => {
                    const pack = starterPacks.find((item) => item.id === packId);
                    actions.selectStarterPack(packId);
                    actions.patchIntentDraft({
                        persona: pack?.personaBias ?? null,
                        primaryVibe: pack?.primaryAnchor ?? null,
                        secondaryVibe: pack?.secondaryAnchors?.[0],
                        district: undefined,
                        distanceMode: pack?.distanceMode ?? state.intentDraft.distanceMode,
                        prefersHiddenGems: pack?.lensPreset?.discoveryBias === 'high',
                    });
                }, onBack: () => actions.setStep('landing'), onContinue: () => actions.setStep('mood') })), state.currentStep === 'mood' && (_jsx(MoodSelectionPage, { primaryVibe: state.intentDraft.primaryVibe, secondaryVibe: state.intentDraft.secondaryVibe, persona: state.intentDraft.persona, city: state.intentDraft.city, neighborhood: state.intentDraft.neighborhood, anchorName: state.selectedAnchorVenue?.name, anchorVenueId: state.intentDraft.anchor?.venueId ?? state.selectedAnchorVenue?.id, showAnchorSearch: state.mode === 'build', discoveryGroups: state.discoveryGroups, discoveryLoading: state.discoveryLoading, selectedVenueIds: state.selectedDiscoveryVenueIds, debugPanel: exploreDebugSnapshot ? _jsx(EngineDebugPanel, { snapshot: exploreDebugSnapshot }) : undefined, onChange: (primary, secondary) => actions.patchIntentDraft({
                    primaryVibe: primary,
                    secondaryVibe: secondary,
                }), onPersonaChange: (persona) => actions.patchIntentDraft({ persona }), onContextChange: (city, neighborhood) => actions.patchIntentDraft({
                    city,
                    district: undefined,
                    neighborhood,
                }), onAnchorSelect: handleAnchorSelect, onToggleDiscoveryVenue: (venueId) => {
                    const selected = state.selectedDiscoveryVenueIds.includes(venueId);
                    if (selected) {
                        actions.setDiscoverySelection(state.selectedDiscoveryVenueIds.filter((id) => id !== venueId));
                        return;
                    }
                    if (state.selectedDiscoveryVenueIds.length >= 2) {
                        return;
                    }
                    actions.setDiscoverySelection([...state.selectedDiscoveryVenueIds, venueId]);
                }, onBack: () => actions.setStep(state.mode === 'curate'
                    ? 'curate'
                    : 'landing'), onNext: () => {
                    actions.setGenerationTarget('preview');
                    actions.setStep('generating');
                } })), state.currentStep === 'preview' && state.generatedItinerary && (_jsx(PreviewPage, { itinerary: state.generatedItinerary, generationTrace: state.generationTrace, planAdjustmentFeedback: previewDirty ? undefined : planAdjustmentFeedback, neighborhood: effectiveDraftInput.neighborhood, startTime: effectiveDraftInput.startTime, distanceMode: effectiveDraftInput.distanceMode, budget: effectiveDraftInput.budget, previewControls: state.previewControls, previewDirty: previewDirty, compositionConflictMessage: state.compositionConflictMessage, alternativesByRole: state.alternativesByRole, alternativeKindsByRole: state.alternativeKindsByRole, roleShapeActionsByRole: previewRoleShapeActionsByRole, composeActionsByRole: previewComposeActionsByRole, ownedStopKindsByRole: previewOwnedStopKindsByRole, adjustDisabledRoles: previewAdjustDisabledRoles, adjustLockedNotesByRole: previewAdjustLockedNotesByRole, unavailableByRole: lceBrokenByRole, lceRepairProposal: lceRepairProposal, lceSystemMessage: lceSystemMessage, lceTraceNote: lceTraceNote, debugPanel: draftDebugSnapshot ? _jsx(EngineDebugPanel, { snapshot: draftDebugSnapshot }) : undefined, onChangePreviewControls: (patch) => actions.patchPreviewControls(patch), onChangeNeighborhood: (neighborhood) => actions.patchIntentDraft({
                    district: undefined,
                    neighborhood,
                }), onChangeBudget: (budget) => actions.patchIntentDraft({ budget }), onShowSwap: handleShowSwap, onApplySwap: handleApplySwap, onApplyRoleShape: handleApplyRoleShape, onApplyComposeAction: handleApplyComposeAction, onSearchCompose: handleSearchCompose, onCreateCustomComposeStop: handleCreateCustomComposeStop, onApplyComposeSearchResult: handleApplyComposeSearchResult, onApplyLceRepairProposal: handleApplyLceRepairProposal, onKeepCurrentPlanAfterLce: handleKeepCurrentPlanAfterLce, onBack: () => {
                    setPlanAdjustmentFeedback(undefined);
                    setPendingPlanAdjustment(undefined);
                    actions.setStep('mood');
                }, onRefresh: () => {
                    setLceRepairProposal(undefined);
                    setLceBrokenByRole({});
                    setLceSystemMessage(undefined);
                    setLceTraceNote(undefined);
                    setPlanAdjustmentFeedback(undefined);
                    if (state.generatedItinerary && state.generationTrace) {
                        setPendingPlanAdjustment({
                            previousPlan: {
                                itinerary: state.generatedItinerary,
                                trace: state.generationTrace,
                            },
                            controls: { ...state.previewControls },
                        });
                    }
                    else {
                        setPendingPlanAdjustment(undefined);
                    }
                    actions.setGenerationTarget('preview');
                    actions.setStep('generating');
                }, onConfirm: () => {
                    setLceRepairProposal(undefined);
                    setLceBrokenByRole({});
                    setLceSystemMessage(undefined);
                    setLceTraceNote(undefined);
                    setPendingPlanAdjustment(undefined);
                    actions.setGenerationTarget('final');
                    actions.setStep('generating');
                } })), state.currentStep === 'generating' && (_jsx(GeneratingPage, { headline: generatingCopy.headline, detail: generatingCopy.detail })), state.currentStep === 'reveal' && state.generatedItinerary && (_jsx(RevealPage, { itinerary: state.generatedItinerary, selectedRefinements: state.selectedRefinements, generationTrace: state.generationTrace, compositionConflictMessage: state.compositionConflictMessage, explorationPlan: state.explorationPlan, explorationLoading: state.explorationLoading, lightNearbyExtensions: lightNearbyExtensions, alternativesByRole: state.alternativesByRole, alternativeKindsByRole: state.alternativeKindsByRole, onShowSwap: handleShowSwap, onShowNearby: handleShowNearby, onApplySwap: handleApplySwap, onApplyRefinement: handleApplyRefinement, onContinueOuting: handleContinueOuting, forceDebug: environment === 'dev', onLock: () => {
                    actions.lockPlan();
                    actions.setStep('ticket');
                }, onStartOver: actions.reset })), state.currentStep === 'ticket' && state.generatedItinerary && (_jsx(TicketPage, { itinerary: state.generatedItinerary, lightNearbyExtensions: lightNearbyExtensions, explorationPlan: state.explorationPlan, explorationLoading: state.explorationLoading, lockedAt: state.lockedAt, onContinueOuting: handleContinueOuting, onStartOver: actions.reset }))] }));
}
export function AppShell({ environment = 'default' }) {
    return (_jsx(SessionStoreProvider, { children: _jsx(AppShellContent, { environment: environment }) }));
}
