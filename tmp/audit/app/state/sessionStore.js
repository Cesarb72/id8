import { createElement, createContext, useContext, useMemo, useReducer, } from 'react';
import { nowIso } from '../../lib/time';
const initialIntentDraft = {
    persona: null,
    primaryVibe: null,
    city: 'San Jose',
    distanceMode: 'nearby',
    prefersHiddenGems: false,
};
const initialSessionState = {
    currentStep: 'landing',
    generationTarget: 'final',
    mode: null,
    intentDraft: initialIntentDraft,
    districtSelectionLoading: false,
    discoveryLoading: false,
    selectedDiscoveryVenueIds: [],
    explorationLoading: false,
    routeEditedByUser: false,
    userComposedStopsByRole: {},
    alternativesByRole: {},
    alternativeKindsByRole: {},
    selectedRefinements: [],
    previewControls: {},
};
function sessionReducer(state, action) {
    if (action.type === 'SET_STEP') {
        if (state.currentStep === action.payload) {
            return state;
        }
        return {
            ...state,
            currentStep: action.payload,
            activeEditor: action.payload === 'crew' || action.payload === 'mood'
                ? state.activeEditor
                : undefined,
        };
    }
    if (action.type === 'SET_ACTIVE_EDITOR') {
        return {
            ...state,
            activeEditor: action.payload,
        };
    }
    if (action.type === 'SET_GENERATION_TARGET') {
        return {
            ...state,
            generationTarget: action.payload,
        };
    }
    if (action.type === 'SET_MODE') {
        return {
            ...state,
            generationTarget: 'final',
            mode: action.payload,
            intentDraft: {
                ...state.intentDraft,
                planningMode: undefined,
                anchor: undefined,
            },
            activeEditor: undefined,
            selectedStarterPackId: undefined,
            districtRecommendations: undefined,
            topDistrictId: undefined,
            districtSelectionLoading: false,
            discoveryGroups: undefined,
            discoveryLoading: false,
            selectedDiscoveryVenueIds: [],
            selectedAnchorVenue: undefined,
            generatedItinerary: undefined,
            generatedArc: undefined,
            scoredVenues: undefined,
            lastIntentProfile: undefined,
            experienceLens: undefined,
            generationTrace: undefined,
            explorationPlan: undefined,
            explorationLoading: false,
            routeEditedByUser: false,
            userComposedStopsByRole: {},
            compositionConflictMessage: undefined,
            alternativesByRole: {},
            alternativeKindsByRole: {},
            selectedRefinements: [],
            previewControls: {},
            lockedAt: undefined,
        };
    }
    if (action.type === 'PATCH_INTENT_DRAFT') {
        const intentDraft = { ...state.intentDraft, ...action.payload };
        const invalidatesDiscovery = 'persona' in action.payload ||
            'primaryVibe' in action.payload ||
            'secondaryVibe' in action.payload ||
            'city' in action.payload ||
            'district' in action.payload ||
            'neighborhood' in action.payload ||
            'planningMode' in action.payload ||
            'anchor' in action.payload;
        return {
            ...state,
            intentDraft,
            previewControls: {
                ...state.previewControls,
                districtPreference: 'city' in action.payload
                    ? undefined
                    : 'district' in action.payload
                        ? action.payload.district
                        : state.previewControls.districtPreference,
            },
            discoveryGroups: invalidatesDiscovery ? undefined : state.discoveryGroups,
            discoveryLoading: invalidatesDiscovery ? false : state.discoveryLoading,
            selectedDiscoveryVenueIds: invalidatesDiscovery ? [] : state.selectedDiscoveryVenueIds,
        };
    }
    if (action.type === 'PATCH_PREVIEW_CONTROLS') {
        return {
            ...state,
            previewControls: {
                ...state.previewControls,
                ...action.payload,
            },
        };
    }
    if (action.type === 'SELECT_STARTER_PACK') {
        return {
            ...state,
            selectedStarterPackId: action.payload,
            districtRecommendations: undefined,
            topDistrictId: undefined,
            districtSelectionLoading: false,
            discoveryGroups: undefined,
            discoveryLoading: false,
            selectedDiscoveryVenueIds: [],
            explorationPlan: undefined,
            explorationLoading: false,
        };
    }
    if (action.type === 'BEGIN_DISTRICT_PREVIEW') {
        return {
            ...state,
            districtRecommendations: undefined,
            topDistrictId: undefined,
            districtSelectionLoading: true,
        };
    }
    if (action.type === 'SET_DISTRICT_PREVIEW') {
        return {
            ...state,
            intentDraft: {
                ...state.intentDraft,
                district: action.payload.selectedDistrictId,
            },
            previewControls: {
                ...state.previewControls,
                districtPreference: action.payload.selectedDistrictId ?? state.previewControls.districtPreference,
            },
            districtRecommendations: action.payload.recommendations,
            topDistrictId: action.payload.topDistrictId,
            districtSelectionLoading: false,
        };
    }
    if (action.type === 'CLEAR_DISTRICT_PREVIEW') {
        return {
            ...state,
            districtRecommendations: undefined,
            topDistrictId: undefined,
            districtSelectionLoading: false,
        };
    }
    if (action.type === 'BEGIN_DISCOVERY_PREVIEW') {
        return {
            ...state,
            discoveryGroups: undefined,
            discoveryLoading: true,
            selectedDiscoveryVenueIds: [],
        };
    }
    if (action.type === 'SET_DISCOVERY_PREVIEW') {
        return {
            ...state,
            discoveryGroups: action.payload,
            discoveryLoading: false,
        };
    }
    if (action.type === 'CLEAR_DISCOVERY_PREVIEW') {
        return {
            ...state,
            discoveryGroups: undefined,
            discoveryLoading: false,
            selectedDiscoveryVenueIds: [],
        };
    }
    if (action.type === 'SET_DISCOVERY_SELECTION') {
        return {
            ...state,
            selectedDiscoveryVenueIds: action.payload,
        };
    }
    if (action.type === 'SET_SELECTED_ANCHOR_VENUE') {
        return {
            ...state,
            selectedAnchorVenue: action.payload,
        };
    }
    if (action.type === 'BEGIN_EXPLORATION') {
        return {
            ...state,
            explorationPlan: undefined,
            explorationLoading: true,
        };
    }
    if (action.type === 'SET_EXPLORATION_PLAN') {
        return {
            ...state,
            explorationPlan: action.payload,
            explorationLoading: false,
        };
    }
    if (action.type === 'CLEAR_EXPLORATION_PLAN') {
        return {
            ...state,
            explorationPlan: undefined,
            explorationLoading: false,
        };
    }
    if (action.type === 'SET_GENERATION') {
        const isPreviewGeneration = state.generationTarget === 'preview';
        return {
            ...state,
            districtSelectionLoading: false,
            discoveryGroups: isPreviewGeneration ? state.discoveryGroups : undefined,
            discoveryLoading: false,
            selectedDiscoveryVenueIds: isPreviewGeneration ? state.selectedDiscoveryVenueIds : [],
            generatedItinerary: action.payload.itinerary,
            generatedArc: action.payload.arc,
            scoredVenues: action.payload.scoredVenues,
            lastIntentProfile: action.payload.intentProfile,
            experienceLens: action.payload.lens,
            generationTrace: action.payload.trace,
            explorationPlan: undefined,
            explorationLoading: false,
            routeEditedByUser: false,
            districtRecommendations: undefined,
            topDistrictId: undefined,
            compositionConflictMessage: undefined,
            alternativesByRole: {},
            alternativeKindsByRole: {},
        };
    }
    if (action.type === 'SET_ARC_AND_ITINERARY') {
        return {
            ...state,
            generatedItinerary: action.payload.itinerary,
            generatedArc: action.payload.arc,
            generationTrace: state.generationTrace
                ? {
                    ...state.generationTrace,
                    selectedArcId: action.payload.arc.id,
                    selectedStopIds: action.payload.arc.stops.map((stop) => stop.scoredVenue.venue.id),
                }
                : state.generationTrace,
            explorationPlan: undefined,
            explorationLoading: false,
            routeEditedByUser: state.routeEditedByUser,
            compositionConflictMessage: undefined,
            alternativesByRole: {},
            alternativeKindsByRole: {},
        };
    }
    if (action.type === 'SET_USER_COMPOSED_STOPS') {
        return {
            ...state,
            userComposedStopsByRole: action.payload,
        };
    }
    if (action.type === 'SET_ROUTE_EDITED_BY_USER') {
        return {
            ...state,
            routeEditedByUser: action.payload,
        };
    }
    if (action.type === 'SET_COMPOSITION_CONFLICT_MESSAGE') {
        return {
            ...state,
            compositionConflictMessage: action.payload,
        };
    }
    if (action.type === 'SET_STOP_ALTERNATIVES') {
        return {
            ...state,
            alternativesByRole: {
                ...state.alternativesByRole,
                [action.payload.role]: action.payload.alternatives,
            },
            alternativeKindsByRole: {
                ...state.alternativeKindsByRole,
                [action.payload.role]: action.payload.kind,
            },
        };
    }
    if (action.type === 'SET_TRACE_ALTERNATIVE_COUNT') {
        if (!state.generationTrace) {
            return state;
        }
        const nextTrace = {
            ...state.generationTrace,
            alternativeCounts: action.payload.kind === 'swap'
                ? {
                    ...state.generationTrace.alternativeCounts,
                    [action.payload.role]: action.payload.count,
                }
                : state.generationTrace.alternativeCounts,
            nearbyAlternativeCounts: action.payload.kind === 'nearby'
                ? {
                    ...state.generationTrace.nearbyAlternativeCounts,
                    [action.payload.role]: action.payload.count,
                }
                : state.generationTrace.nearbyAlternativeCounts,
        };
        return {
            ...state,
            generationTrace: nextTrace,
        };
    }
    if (action.type === 'CLEAR_STOP_ALTERNATIVES') {
        if (!action.payload) {
            return { ...state, alternativesByRole: {}, alternativeKindsByRole: {} };
        }
        const nextAlternatives = { ...state.alternativesByRole };
        const nextKinds = { ...state.alternativeKindsByRole };
        delete nextAlternatives[action.payload];
        delete nextKinds[action.payload];
        return { ...state, alternativesByRole: nextAlternatives, alternativeKindsByRole: nextKinds };
    }
    if (action.type === 'SET_REFINEMENTS') {
        return {
            ...state,
            selectedRefinements: action.payload,
        };
    }
    if (action.type === 'LOCK_PLAN') {
        return { ...state, lockedAt: nowIso() };
    }
    return { ...initialSessionState };
}
const SessionContext = createContext(null);
function buildActions(dispatch) {
    return {
        setStep(step) {
            dispatch({ type: 'SET_STEP', payload: step });
        },
        setGenerationTarget(target) {
            dispatch({ type: 'SET_GENERATION_TARGET', payload: target });
        },
        setActiveEditor(step) {
            dispatch({ type: 'SET_ACTIVE_EDITOR', payload: step });
        },
        setMode(mode) {
            dispatch({ type: 'SET_MODE', payload: mode });
        },
        patchIntentDraft(patch) {
            dispatch({ type: 'PATCH_INTENT_DRAFT', payload: patch });
        },
        patchPreviewControls(patch) {
            dispatch({ type: 'PATCH_PREVIEW_CONTROLS', payload: patch });
        },
        selectStarterPack(packId) {
            dispatch({ type: 'SELECT_STARTER_PACK', payload: packId });
        },
        beginDistrictPreview() {
            dispatch({ type: 'BEGIN_DISTRICT_PREVIEW' });
        },
        setDistrictPreview(recommendations, topDistrictId, selectedDistrictId) {
            dispatch({
                type: 'SET_DISTRICT_PREVIEW',
                payload: {
                    recommendations,
                    topDistrictId,
                    selectedDistrictId,
                },
            });
        },
        clearDistrictPreview() {
            dispatch({ type: 'CLEAR_DISTRICT_PREVIEW' });
        },
        beginDiscoveryPreview() {
            dispatch({ type: 'BEGIN_DISCOVERY_PREVIEW' });
        },
        setDiscoveryPreview(groups) {
            dispatch({ type: 'SET_DISCOVERY_PREVIEW', payload: groups });
        },
        clearDiscoveryPreview() {
            dispatch({ type: 'CLEAR_DISCOVERY_PREVIEW' });
        },
        setDiscoverySelection(venueIds) {
            dispatch({ type: 'SET_DISCOVERY_SELECTION', payload: venueIds });
        },
        setSelectedAnchorVenue(venue) {
            dispatch({ type: 'SET_SELECTED_ANCHOR_VENUE', payload: venue });
        },
        beginExploration() {
            dispatch({ type: 'BEGIN_EXPLORATION' });
        },
        setExplorationPlan(plan) {
            dispatch({ type: 'SET_EXPLORATION_PLAN', payload: plan });
        },
        clearExplorationPlan() {
            dispatch({ type: 'CLEAR_EXPLORATION_PLAN' });
        },
        setGeneration(itinerary, arc, scoredVenues, intentProfile, lens, trace) {
            dispatch({
                type: 'SET_GENERATION',
                payload: {
                    itinerary,
                    arc,
                    scoredVenues,
                    intentProfile,
                    lens,
                    trace,
                },
            });
        },
        setArcAndItinerary(itinerary, arc) {
            dispatch({
                type: 'SET_ARC_AND_ITINERARY',
                payload: { itinerary, arc },
            });
        },
        setUserComposedStops(stopsByRole) {
            dispatch({
                type: 'SET_USER_COMPOSED_STOPS',
                payload: stopsByRole,
            });
        },
        setRouteEditedByUser(value) {
            dispatch({
                type: 'SET_ROUTE_EDITED_BY_USER',
                payload: value,
            });
        },
        setCompositionConflictMessage(message) {
            dispatch({
                type: 'SET_COMPOSITION_CONFLICT_MESSAGE',
                payload: message,
            });
        },
        setStopAlternatives(role, alternatives, kind) {
            dispatch({
                type: 'SET_STOP_ALTERNATIVES',
                payload: { role, alternatives, kind },
            });
        },
        setTraceAlternativeCount(role, count, kind) {
            dispatch({
                type: 'SET_TRACE_ALTERNATIVE_COUNT',
                payload: { role, count, kind },
            });
        },
        clearStopAlternatives(role) {
            dispatch({ type: 'CLEAR_STOP_ALTERNATIVES', payload: role });
        },
        setRefinements(refinements) {
            dispatch({ type: 'SET_REFINEMENTS', payload: refinements });
        },
        lockPlan() {
            dispatch({ type: 'LOCK_PLAN' });
        },
        reset() {
            dispatch({ type: 'RESET' });
        },
    };
}
export function SessionStoreProvider({ children }) {
    const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
    const actions = useMemo(() => buildActions(dispatch), [dispatch]);
    const value = useMemo(() => ({ state, actions }), [state, actions]);
    return createElement(SessionContext.Provider, { value }, children);
}
export function useSessionStore() {
    const store = useContext(SessionContext);
    if (!store) {
        throw new Error('useSessionStore must be used inside SessionStoreProvider.');
    }
    return store;
}
