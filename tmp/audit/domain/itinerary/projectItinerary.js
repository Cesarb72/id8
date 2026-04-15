import { createId } from '../../lib/ids';
import { roleProjection } from '../config/roleProjection';
import { buildPlanNarrative } from './buildPlanNarrative';
import { buildPlanSubtitle } from './buildPlanSubtitle';
import { buildShareSummary } from './buildShareSummary';
import { generateStopInsider } from './generateStopInsider';
import { generateStorySpine } from './generateStorySpine';
import { projectStop } from './projectStop';
import { getVibeLabel } from '../types/intent';
const categoryKeys = [
    'restaurant',
    'bar',
    'cafe',
    'dessert',
    'live_music',
    'activity',
    'park',
    'museum',
    'event',
];
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function normalizeScoringValue(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return undefined;
    }
    return value > 1 ? value / 100 : value;
}
function buildLocalCategoryMix(arc, index) {
    const counts = Object.fromEntries(categoryKeys.map((category) => [category, 0]));
    const candidateIndices = [index - 1, index, index + 1].filter((candidateIndex) => candidateIndex >= 0 && candidateIndex < arc.stops.length);
    if (candidateIndices.length === 0) {
        return counts;
    }
    for (const candidateIndex of candidateIndices) {
        const category = arc.stops[candidateIndex]?.scoredVenue.venue.category;
        if (category) {
            counts[category] += 1;
        }
    }
    const total = candidateIndices.length;
    return Object.fromEntries(categoryKeys.map((category) => [category, counts[category] / total]));
}
function getLocalTransitions(arc, index) {
    return [arc.pacing.transitions[index - 1], arc.pacing.transitions[index]].filter((transition) => Boolean(transition));
}
function getLocalTravelMinutes(arc, index) {
    const transitions = getLocalTransitions(arc, index);
    if (transitions.length === 0) {
        return 0;
    }
    const total = transitions.reduce((sum, transition) => sum + transition.estimatedTransitionMinutes, 0);
    return total / transitions.length;
}
function getLocalFriction(arc, index) {
    const transitions = getLocalTransitions(arc, index);
    if (transitions.length === 0) {
        return arc.pacing.averageTransitionFriction;
    }
    const total = transitions.reduce((sum, transition) => sum + transition.frictionScore, 0);
    return total / transitions.length;
}
function getLocalContinuity(arc, index) {
    const transitions = getLocalTransitions(arc, index);
    if (transitions.some((transition) => transition.neighborhoodContinuity === 'spread')) {
        return 'spread';
    }
    if (transitions.some((transition) => transition.neighborhoodContinuity === 'adjacent-neighborhoods')) {
        return 'adjacent-neighborhoods';
    }
    return 'same-neighborhood';
}
function getLocalMovementMode(arc, index) {
    const transitions = getLocalTransitions(arc, index);
    if (transitions.some((transition) => transition.movementMode === 'drive')) {
        return 'drive';
    }
    if (transitions.some((transition) => transition.movementMode === 'short-drive')) {
        return 'short-drive';
    }
    return 'walkable';
}
function buildItineraryTitle(intent, hasWildcard) {
    const primary = getVibeLabel(intent.primaryAnchor);
    const secondary = intent.secondaryAnchors?.[0]
        ? ` + ${getVibeLabel(intent.secondaryAnchors[0])}`
        : '';
    const suffix = hasWildcard ? 'Curated Trail' : 'Signature Trail';
    return `${primary}${secondary} ${suffix}`;
}
export function projectItinerary(arc, intent, lens, stopExplainability) {
    const stops = arc.stops.map((stop, index) => {
        const userRole = roleProjection[stop.role];
        const explainability = stopExplainability?.[userRole];
        const localTravelMinutes = getLocalTravelMinutes(arc, index);
        const localFriction = getLocalFriction(arc, index);
        const travelPenalty = Math.min(1, localTravelMinutes / 24);
        const frictionPenalty = Math.min(1, localFriction);
        const compactness = clamp01(1 - travelPenalty * 0.56 - frictionPenalty * 0.44);
        const activation = stop.scoredVenue.taste.signals.hyperlocalActivation;
        const activationBoost = activation.primaryActivationType ? 0.24 : 0;
        const nearbyActivation = clamp01(activation.temporalRelevance * 0.76 + activationBoost);
        const stopInsider = generateStopInsider({
            role: userRole,
            category: stop.scoredVenue.venue.category,
            energyLevel: stop.scoredVenue.venue.energyLevel,
            socialDensity: stop.scoredVenue.taste.signals.socialDensity,
            momentPotential: stop.scoredVenue.taste.signals.momentPotential.score,
            momentIntensity: stop.scoredVenue.taste.signals.momentIntensity.score,
            roleScore: stop.scoredVenue.roleScores[stop.role],
            contextSpecificity: stop.scoredVenue.contextSpecificity.byRole[stop.role],
            selectionConfidence: explainability?.selectionConfidence,
            selectedScore: normalizeScoringValue(explainability?.selectedScore),
            runnerUpScore: normalizeScoringValue(explainability?.runnerUpScore),
            route: {
                localTravelMinutes,
                localContinuity: getLocalContinuity(arc, index),
                localMovementMode: getLocalMovementMode(arc, index),
                compactness,
                nearbyCategoryMix: buildLocalCategoryMix(arc, index),
                nearbyActivation,
            },
        });
        return projectStop(stop, arc.pacing.stops[index], lens, explainability, stopInsider);
    });
    const title = buildItineraryTitle(intent, arc.hasWildcard);
    const itineraryBase = {
        id: createId('itinerary'),
        title,
        city: intent.city,
        neighborhood: intent.neighborhood,
        crew: intent.crew,
        vibes: [intent.primaryAnchor, ...(intent.secondaryAnchors ?? [])],
        stops,
        transitions: arc.pacing.transitions.map((transition, index) => ({
            fromStopId: stops[index].id,
            toStopId: stops[index + 1].id,
            estimatedTravelMinutes: transition.estimatedTravelMinutes,
            transitionBufferMinutes: transition.transitionBufferMinutes,
            estimatedTransitionMinutes: transition.estimatedTransitionMinutes,
            frictionScore: transition.frictionScore,
            movementMode: transition.movementMode,
            neighborhoodContinuity: transition.neighborhoodContinuity,
        })),
        totalRouteFriction: arc.pacing.totalRouteFriction,
        estimatedTotalMinutes: arc.pacing.estimatedTotalMinutes,
        estimatedTotalLabel: arc.pacing.estimatedTotalLabel,
        routeFeelLabel: arc.pacing.routeFeelLabel,
    };
    const story = {
        headline: buildPlanNarrative(intent, itineraryBase),
        subtitle: buildPlanSubtitle(intent, itineraryBase),
    };
    const itineraryWithoutSummary = {
        ...itineraryBase,
        story,
        storySpine: generateStorySpine({
            stops: itineraryBase.stops,
            transitions: itineraryBase.transitions,
            totalRouteFriction: itineraryBase.totalRouteFriction,
        }, {
            vibe: intent.primaryAnchor,
            crew: intent.crew,
            persona: intent.persona,
        }),
    };
    return {
        ...itineraryWithoutSummary,
        shareSummary: buildShareSummary(itineraryWithoutSummary),
    };
}
