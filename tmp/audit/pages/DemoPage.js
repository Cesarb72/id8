import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ID8Butler } from '../components/butler/ID8Butler';
import { RealityCommitStep, getRealityInterpretation, } from '../components/demo/RealityCommitStep';
import { JourneyMapReal } from '../components/journey/JourneyMapReal';
import { RouteSpine } from '../components/journey/RouteSpine';
import { PageShell } from '../components/layout/PageShell';
import { swapArcStop } from '../domain/arc/swapArcStop';
import { inverseRoleProjection } from '../domain/config/roleProjection';
import { saveLiveArtifactSession } from '../domain/live/liveArtifactSession';
import { getCrewPolicy } from '../domain/intent/getCrewPolicy';
import { projectItinerary } from '../domain/itinerary/projectItinerary';
import { buildTonightSignals } from '../domain/journey/buildTonightSignals';
import { runGeneratePlan } from '../domain/runGeneratePlan';
const personaOptions = [
    { label: 'Romantic', value: 'romantic' },
    { label: 'Friends', value: 'friends' },
    { label: 'Family', value: 'family' },
];
const vibeOptions = [
    { label: 'Lively', value: 'lively' },
    { label: 'Cozy', value: 'cozy' },
    { label: 'Cultured', value: 'cultured' },
];
const clusterRefinementMap = {
    lively: ['more-exciting'],
    chill: ['more-relaxed'],
    explore: ['more-unique'],
};
const roleToInternalRole = {
    start: 'warmup',
    highlight: 'peak',
    surprise: 'wildcard',
    windDown: 'cooldown',
};
function findScoredVenueForStop(stop, selectedArc) {
    const targetRole = inverseRoleProjection[stop.role];
    const matched = selectedArc.stops.find((arcStop) => arcStop.role === targetRole &&
        arcStop.scoredVenue.venue.id === stop.venueId);
    if (matched) {
        return matched.scoredVenue;
    }
    return selectedArc.stops.find((arcStop) => arcStop.role === targetRole)?.scoredVenue;
}
function getCoreStop(itinerary, role) {
    return itinerary.stops.find((stop) => stop.role === role);
}
function getRouteArcType(itinerary) {
    const hasStart = itinerary.stops.some((stop) => stop.role === 'start');
    const hasHighlight = itinerary.stops.some((stop) => stop.role === 'highlight');
    const hasWindDown = itinerary.stops.some((stop) => stop.role === 'windDown');
    if (hasHighlight && hasStart && hasWindDown) {
        return 'full';
    }
    if (hasHighlight && (hasStart || hasWindDown)) {
        return 'partial';
    }
    return 'highlightOnly';
}
function getHighlightIntensityFromArc(arc) {
    return arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue.taste.signals.momentIntensity.score;
}
function getBearingsSignal(itinerary) {
    const transitions = itinerary.transitions;
    if (transitions.length === 0) {
        return 'Everything stays within a short drive.';
    }
    const maxTravel = Math.max(...transitions.map((transition) => transition.estimatedTravelMinutes));
    if (maxTravel <= 12) {
        return 'Everything stays within a short drive.';
    }
    return 'This route avoids long travel gaps.';
}
function toTitleCase(value) {
    return value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
function getKnownForLine(stop) {
    const priorityTags = stop.tags.filter((tag) => ['jazz', 'cocktails', 'wine', 'dessert', 'chef-led', 'tasting', 'speakeasy', 'tea'].includes(tag.toLowerCase()));
    const tags = (priorityTags.length > 0 ? priorityTags : stop.tags).slice(0, 2);
    if (tags.length > 0) {
        return `Known for ${tags.map((tag) => toTitleCase(tag)).join(' and ')}.`;
    }
    if (stop.subcategory) {
        return `Known for its ${toTitleCase(stop.subcategory)} focus.`;
    }
    return `Known for a strong local fit in ${stop.neighborhood}.`;
}
function toTagSet(tags) {
    return new Set(tags.map((tag) => tag.toLowerCase()));
}
function getAlternativeDescriptor(candidate) {
    const tags = toTagSet(candidate.venue.tags);
    if (['intimate', 'quiet', 'cozy', 'conversation', 'tea-room'].some((tag) => tags.has(tag))) {
        return 'more intimate';
    }
    if (['live', 'jazz', 'music', 'social', 'cocktails', 'late-night'].some((tag) => tags.has(tag))) {
        return 'more lively';
    }
    if (['dessert', 'gelato', 'ice-cream', 'tea', 'pastry'].some((tag) => tags.has(tag))) {
        return 'slower pace';
    }
    if (candidate.venue.category === 'museum' || candidate.venue.category === 'event') {
        return 'slower pace';
    }
    if (candidate.venue.category === 'park') {
        return 'more open-air';
    }
    if (candidate.venue.driveMinutes <= 8) {
        return 'closer, easier stop';
    }
    return 'different vibe';
}
function getRoleAlternatives(stop, scoredVenues, itineraryStops, currentArc, intent, lens) {
    const role = roleToInternalRole[stop.role];
    const usedVenueIds = new Set(itineraryStops.map((item) => item.venueId));
    const currentVenueId = stop.venueId;
    const crewPolicy = getCrewPolicy(intent.crew);
    const buildRanked = (includeUsed, minRoleScore) => scoredVenues
        .filter((candidate) => candidate.venue.id !== currentVenueId)
        .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
        .filter((candidate) => (includeUsed ? true : !usedVenueIds.has(candidate.venue.id)))
        .filter((candidate) => candidate.roleScores[role] >= minRoleScore)
        .filter((candidate) => Boolean(swapArcStop({
        currentArc,
        role: inverseRoleProjection[stop.role],
        replacement: candidate,
        intent,
        crewPolicy,
        lens,
    })))
        .sort((left, right) => {
        const leftProximity = 1 / (1 + Math.abs(left.venue.driveMinutes - stop.driveMinutes));
        const rightProximity = 1 / (1 + Math.abs(right.venue.driveMinutes - stop.driveMinutes));
        const leftScore = left.roleScores[role] * 0.62 + left.fitScore * 0.24 + leftProximity * 0.14;
        const rightScore = right.roleScores[role] * 0.62 + right.fitScore * 0.24 + rightProximity * 0.14;
        return rightScore - leftScore || left.venue.name.localeCompare(right.venue.name);
    });
    const strictPrimary = buildRanked(false, 0.52);
    const strictFallback = buildRanked(true, 0.52);
    const relaxedPrimary = buildRanked(false, 0.44);
    const relaxedFallback = buildRanked(true, 0.44);
    const combined = [...strictPrimary, ...strictFallback, ...relaxedPrimary, ...relaxedFallback];
    const alternatives = [];
    const seenVenueIds = new Set();
    for (const candidate of combined) {
        if (seenVenueIds.has(candidate.venue.id)) {
            continue;
        }
        seenVenueIds.add(candidate.venue.id);
        alternatives.push({
            venueId: candidate.venue.id,
            name: candidate.venue.name,
            descriptor: getAlternativeDescriptor(candidate),
        });
        if (alternatives.length >= 3) {
            break;
        }
    }
    return alternatives;
}
function getLocalSignal(stop) {
    const tags = toTagSet(stop.tags);
    if (['reservations', 'reservation-recommended', 'book-ahead', 'bookings'].some((tag) => tags.has(tag))) {
        return 'Reservations recommended.';
    }
    if (['late-night', 'night-owl', 'live', 'jazz', 'small-stage'].some((tag) => tags.has(tag))) {
        return 'Fills quickly after 9pm.';
    }
    if (['walk-up', 'quick-start', 'coffee', 'tea-room', 'dessert', 'gelato'].some((tag) => tags.has(tag))) {
        return 'Best earlier in the evening.';
    }
    if (stop.role === 'windDown') {
        return 'Best once the main moment eases out.';
    }
    if (stop.category === 'restaurant' || stop.category === 'bar' || stop.category === 'live_music') {
        return 'Reservations recommended.';
    }
    return 'Best earlier in the evening.';
}
function buildVenueLinkUrl(stop) {
    const query = [stop.venueName, stop.neighborhood, stop.city].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
function getRoleTravelWindow(itinerary, role) {
    const stopIndex = itinerary.stops.findIndex((stop) => stop.role === role);
    if (stopIndex < 0) {
        return 0;
    }
    const before = stopIndex > 0 ? itinerary.transitions[stopIndex - 1]?.estimatedTravelMinutes ?? 0 : 0;
    const after = stopIndex < itinerary.stops.length - 1
        ? itinerary.transitions[stopIndex]?.estimatedTravelMinutes ?? 0
        : 0;
    return before + after;
}
function getSwapTradeoffSignal(role, candidate) {
    const tags = toTagSet(candidate.tags);
    if (role === 'highlight') {
        if (candidate.category === 'museum' ||
            candidate.category === 'event' ||
            ['quiet', 'cozy', 'curated', 'gallery'].some((tag) => tags.has(tag))) {
            return 'Keeps the centerpiece, shifts to a quieter pace.';
        }
        if (candidate.category === 'live_music' ||
            ['live', 'jazz', 'social', 'cocktails', 'late-night'].some((tag) => tags.has(tag))) {
            return 'Keeps the centerpiece, shifts to a livelier middle.';
        }
        return 'Keeps the centerpiece, shifts the tone.';
    }
    if (role === 'start') {
        if (['coffee', 'tea-room', 'quiet'].some((tag) => tags.has(tag))) {
            return 'Starts with a calmer first beat.';
        }
        return 'Starts with a more active first beat.';
    }
    return 'Keeps the route shape, changes the landing style.';
}
function getSwapCascadeHint(role, candidate) {
    const tags = toTagSet(candidate.tags);
    if (role === 'highlight') {
        return ['quiet', 'cozy', 'conversation'].some((tag) => tags.has(tag))
            ? 'May soften the ending.'
            : 'May tighten the ending.';
    }
    if (role === 'start') {
        return 'May shift how quickly the middle builds.';
    }
    return 'May change how gently the night lands.';
}
function getPostSwapHintRole(role) {
    if (role === 'start') {
        return 'highlight';
    }
    if (role === 'highlight') {
        return 'windDown';
    }
    return null;
}
function getPostSwapHintText(role) {
    if (role === 'start') {
        return 'You may want to keep the middle focused.';
    }
    if (role === 'highlight') {
        return 'You may want to tighten this ending.';
    }
    return null;
}
function getHighlightTypeLabel(stop) {
    if (!stop) {
        return 'main highlight';
    }
    const tags = toTagSet(stop.tags);
    const late = tags.has('late-night') || tags.has('night-owl');
    if (tags.has('jazz')) {
        return late ? 'late jazz set' : 'jazz set';
    }
    if (stop.category === 'live_music' || ['live', 'music', 'performance', 'listening'].some((tag) => tags.has(tag))) {
        return late ? 'late live music set' : 'live music set';
    }
    if (stop.category === 'restaurant' || ['dinner', 'chef-led', 'tasting'].some((tag) => tags.has(tag))) {
        return 'dinner anchor';
    }
    if (stop.category === 'bar' || ['cocktails', 'social'].some((tag) => tags.has(tag))) {
        return 'cocktail-forward highlight';
    }
    return 'main highlight';
}
function getStartPacingLabel(stop) {
    if (!stop) {
        return 'a balanced start';
    }
    const tags = toTagSet(stop.tags);
    if (['quiet', 'cozy', 'conversation', 'coffee', 'tea-room', 'tea'].some((tag) => tags.has(tag))) {
        return 'a relaxed start';
    }
    if (['high-energy', 'buzzing', 'social', 'lively'].some((tag) => tags.has(tag))) {
        return 'an energetic start';
    }
    return 'a balanced start';
}
function getFinishPacingLabel(stop) {
    if (!stop) {
        return 'a clean finish';
    }
    const tags = toTagSet(stop.tags);
    if (['dessert', 'quiet', 'cozy', 'tea-room', 'tea'].some((tag) => tags.has(tag))) {
        return 'a clean finish';
    }
    if (['social', 'late-night', 'cocktails'].some((tag) => tags.has(tag))) {
        return 'a social finish';
    }
    return 'a clean finish';
}
function getVibeNarrativeLabel(cluster) {
    if (cluster === 'lively') {
        return 'lively';
    }
    if (cluster === 'chill') {
        return 'slower-paced';
    }
    return 'exploratory';
}
function getNightPreviewMode(cluster, itinerary) {
    let socialScore = 0;
    let exploratoryScore = 0;
    let intimateScore = 0;
    itinerary.stops.forEach((stop) => {
        const tags = toTagSet(stop.tags);
        if (stop.category === 'live_music' ||
            stop.category === 'bar' ||
            ['live', 'music', 'jazz', 'social', 'cocktails'].some((tag) => tags.has(tag))) {
            socialScore += 1;
        }
        if (stop.category === 'museum' ||
            stop.category === 'activity' ||
            stop.category === 'park' ||
            ['gallery', 'culture', 'walking', 'walkable', 'explore'].some((tag) => tags.has(tag))) {
            exploratoryScore += 1;
        }
        if (stop.category === 'restaurant' ||
            ['quiet', 'cozy', 'conversation', 'tea', 'dessert', 'courtyard'].some((tag) => tags.has(tag))) {
            intimateScore += 1;
        }
    });
    if (socialScore > exploratoryScore && socialScore > intimateScore) {
        return 'social';
    }
    if (exploratoryScore > socialScore && exploratoryScore > intimateScore) {
        return 'exploratory';
    }
    if (intimateScore > socialScore && intimateScore > exploratoryScore) {
        return 'intimate';
    }
    if (cluster === 'lively') {
        return 'social';
    }
    if (cluster === 'explore') {
        return 'exploratory';
    }
    return 'intimate';
}
function getPreviewOneLiner(cluster, itinerary) {
    const mode = getNightPreviewMode(cluster, itinerary);
    if (mode === 'social') {
        return 'A lively night that builds and keeps moving';
    }
    if (mode === 'exploratory') {
        return 'A relaxed night with room to wander and discover';
    }
    return 'A slower night built around a few strong moments';
}
function getClusterInterpretation(cluster) {
    if (cluster === 'lively') {
        return 'Higher social momentum with a stronger midpoint.';
    }
    if (cluster === 'chill') {
        return 'Softer pacing with a steadier build into the highlight.';
    }
    return 'More exploratory pacing with contrast across stops.';
}
function getRouteThesis(cluster, itinerary) {
    void cluster;
    void itinerary;
    return '';
}
function getPreviewContinuityLine(_cluster, _itinerary, _arc) {
    return 'Everything stays close and easy to move between';
}
function getPreviewStopDescription(stop) {
    if (!stop) {
        return 'This stop keeps the night moving.';
    }
    if (stop.role === 'start') {
        return `Start easy at ${stop.venueName} — a low-key spot to ease in.`;
    }
    if (stop.role === 'highlight') {
        return `Head to ${stop.venueName} — this is where the night peaks.`;
    }
    if (stop.role === 'windDown') {
        return `Wrap up at ${stop.venueName} — a relaxed place to land softly.`;
    }
    return `If you want a pivot, ${stop.venueName} adds a flexible detour.`;
}
function getInlineStopNarrative(stop, intent, options) {
    const localSignal = getLocalSignal(stop);
    const venueLinkUrl = buildVenueLinkUrl(stop);
    const tonightSignals = buildTonightSignals({
        stop,
        scoredVenue: options?.scoredVenue,
        roleTravelWindowMinutes: options?.roleTravelWindowMinutes,
        nearbySummary: options?.nearbySummary,
    });
    if (stop.role === 'highlight') {
        return {
            whyItFits: 'Stronger centerpiece than the closer options.',
            tonightSignals,
            knownFor: getKnownForLine(stop),
            goodToKnow: 'Best once the surrounding district is already picking up.',
            localSignal,
            venueLinkUrl,
        };
    }
    if (stop.role === 'start') {
        return {
            whyItFits: 'Sets the tone fast without peaking too early.',
            tonightSignals,
            knownFor: getKnownForLine(stop),
            goodToKnow: intent.persona === 'family'
                ? 'Good first stop when arrivals are staggered.'
                : 'Works well as an easy meeting point before the middle builds.',
            localSignal,
            venueLinkUrl,
        };
    }
    if (stop.role === 'windDown') {
        return {
            whyItFits: 'Lets the night land softly after the peak.',
            tonightSignals,
            knownFor: getKnownForLine(stop),
            goodToKnow: 'Best when you want a lower-noise finish with easy exits.',
            localSignal,
            venueLinkUrl,
        };
    }
    return {
        whyItFits: 'Adds contrast without breaking route flow.',
        tonightSignals,
        knownFor: getKnownForLine(stop),
        goodToKnow: 'Good as a flexible support stop if timing shifts.',
        localSignal,
        venueLinkUrl,
    };
}
function getInlineStopDetail(stop, intent, scoredVenues, itineraryStops, currentArc, lens, options) {
    const narrative = getInlineStopNarrative(stop, intent, {
        scoredVenue: findScoredVenueForStop(stop, currentArc),
        roleTravelWindowMinutes: options?.roleTravelWindowMinutes,
        nearbySummary: options?.nearbySummary,
    });
    const alternatives = getRoleAlternatives(stop, scoredVenues, itineraryStops, currentArc, intent, lens);
    return {
        ...narrative,
        alternatives,
    };
}
export function DemoPage() {
    const [city, setCity] = useState('San Jose');
    const [persona, setPersona] = useState('romantic');
    const [primaryVibe, setPrimaryVibe] = useState('lively');
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState();
    const [plan, setPlan] = useState();
    const [hasRevealed, setHasRevealed] = useState(false);
    const [activeRole, setActiveRole] = useState('start');
    const [nearbySummaryByRole, setNearbySummaryByRole] = useState({});
    const [isLocking, setIsLocking] = useState(false);
    const [previewSwap, setPreviewSwap] = useState();
    const [appliedSwapRole, setAppliedSwapRole] = useState(null);
    const generatePlan = async () => {
        if (!selectedCluster) {
            return;
        }
        setLoading(true);
        setError(undefined);
        setIsLocking(false);
        setHasRevealed(false);
        setPreviewSwap(undefined);
        setAppliedSwapRole(null);
        setNearbySummaryByRole({});
        try {
            const interpretation = getRealityInterpretation(persona, primaryVibe);
            const selectedClusterConfirmation = interpretation.cards[selectedCluster].confirmation;
            const result = await runGeneratePlan({
                mode: 'build',
                planningMode: 'engine-led',
                persona,
                primaryVibe,
                city: city.trim() || 'San Jose',
                distanceMode: 'nearby',
                refinementModes: clusterRefinementMap[selectedCluster],
            }, {
                sourceMode: 'curated',
                sourceModeOverrideApplied: true,
                debugMode: false,
            });
            setPlan({
                itinerary: result.itinerary,
                selectedArc: result.selectedArc,
                scoredVenues: result.scoredVenues,
                intentProfile: result.intentProfile,
                lens: result.lens,
                selectedCluster,
                selectedClusterConfirmation,
            });
            setActiveRole('start');
            setNearbySummaryByRole({});
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Failed to generate plan.');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        setSelectedCluster(null);
        setHasRevealed(false);
        setIsLocking(false);
        setPreviewSwap(undefined);
        setAppliedSwapRole(null);
        setNearbySummaryByRole({});
    }, [persona, primaryVibe]);
    const handleNearbySummaryChange = useCallback((role, summary) => {
        setNearbySummaryByRole((current) => {
            if (!summary) {
                if (!(role in current)) {
                    return current;
                }
                const next = { ...current };
                delete next[role];
                return next;
            }
            if (current[role] === summary) {
                return current;
            }
            return {
                ...current,
                [role]: summary,
            };
        });
    }, []);
    const handlePreviewAlternative = (role, venueId) => {
        if (!plan) {
            return;
        }
        const replacement = plan.scoredVenues.find((candidate) => candidate.venue.id === venueId);
        const originalStop = plan.itinerary.stops.find((stop) => stop.role === role);
        if (!replacement || !originalStop) {
            return;
        }
        const crewPolicy = getCrewPolicy(plan.intentProfile.crew);
        const swappedArc = swapArcStop({
            currentArc: plan.selectedArc,
            role: inverseRoleProjection[role],
            replacement,
            intent: plan.intentProfile,
            crewPolicy,
            lens: plan.lens,
        });
        if (!swappedArc) {
            return;
        }
        const swappedItinerary = projectItinerary(swappedArc, plan.intentProfile, plan.lens);
        const candidateStop = swappedItinerary.stops.find((stop) => stop.role === role);
        if (!candidateStop) {
            return;
        }
        const candidateNarrative = getInlineStopNarrative(candidateStop, plan.intentProfile, {
            scoredVenue: findScoredVenueForStop(candidateStop, swappedArc),
            roleTravelWindowMinutes: getRoleTravelWindow(swappedItinerary, role),
        });
        const originalTravel = getRoleTravelWindow(plan.itinerary, role);
        const candidateTravel = getRoleTravelWindow(swappedItinerary, role);
        const travelDelta = Math.round(candidateTravel - originalTravel);
        const constraintSignal = travelDelta >= 2
            ? `Adds ~${travelDelta} min travel.`
            : travelDelta <= -2
                ? `Saves ~${Math.abs(travelDelta)} min travel.`
                : 'Keeps travel about the same.';
        setActiveRole(role);
        setPreviewSwap({
            role,
            originalStop,
            candidateStop,
            swappedArc,
            swappedItinerary,
            descriptor: getAlternativeDescriptor(replacement),
            whyItFits: candidateNarrative.whyItFits,
            knownFor: candidateNarrative.knownFor,
            localSignal: candidateNarrative.localSignal ?? 'Best earlier in the evening.',
            venueLinkUrl: candidateNarrative.venueLinkUrl ?? buildVenueLinkUrl(candidateStop),
            tradeoffSignal: getSwapTradeoffSignal(role, candidateStop),
            constraintSignal,
            cascadeHint: getSwapCascadeHint(role, candidateStop),
        });
        setAppliedSwapRole(null);
    };
    const handleApplyPreviewSwap = (role) => {
        if (!plan || !previewSwap || previewSwap.role !== role) {
            return;
        }
        setPlan({
            ...plan,
            itinerary: previewSwap.swappedItinerary,
            selectedArc: previewSwap.swappedArc,
        });
        setPreviewSwap(undefined);
        setAppliedSwapRole(role);
        setActiveRole(role);
    };
    const handleKeepCurrentSwap = (role) => {
        if (!previewSwap || previewSwap.role !== role) {
            return;
        }
        setPreviewSwap(undefined);
    };
    const handleLockNight = () => {
        if (!plan || isLocking) {
            return;
        }
        setIsLocking(true);
        saveLiveArtifactSession({
            city: plan.itinerary.city || city.trim() || 'San Jose',
            itinerary: plan.itinerary,
            selectedClusterConfirmation: plan.selectedClusterConfirmation,
            initialActiveRole: activeRole,
            lockedAt: Date.now(),
        });
        window.setTimeout(() => {
            window.location.assign('/journey/live');
        }, 220);
    };
    const startStop = useMemo(() => (plan ? getCoreStop(plan.itinerary, 'start') : undefined), [plan]);
    const highlightStop = useMemo(() => (plan ? getCoreStop(plan.itinerary, 'highlight') : undefined), [plan]);
    const windDownStop = useMemo(() => (plan ? getCoreStop(plan.itinerary, 'windDown') : undefined), [plan]);
    const previewCoreStops = useMemo(() => plan
        ? plan.itinerary.stops.filter((stop) => ['start', 'highlight', 'surprise', 'windDown'].includes(stop.role))
        : [], [plan]);
    const previewImage = highlightStop?.imageUrl ?? startStop?.imageUrl ?? windDownStop?.imageUrl;
    const inlineDetailsByRole = useMemo(() => {
        if (!plan) {
            return {};
        }
        return Object.fromEntries(plan.itinerary.stops.map((stop) => {
            const inlineDetail = getInlineStopDetail(stop, plan.intentProfile, plan.scoredVenues, plan.itinerary.stops, plan.selectedArc, plan.lens, {
                roleTravelWindowMinutes: getRoleTravelWindow(plan.itinerary, stop.role),
                nearbySummary: nearbySummaryByRole[stop.role],
            });
            const nearbySummary = nearbySummaryByRole[stop.role];
            if (nearbySummary) {
                inlineDetail.aroundHereSignals = [nearbySummary];
            }
            return [stop.role, inlineDetail];
        }));
    }, [nearbySummaryByRole, plan]);
    const appliedSwapNoteByRole = useMemo(() => {
        if (!appliedSwapRole) {
            return {};
        }
        return {
            [appliedSwapRole]: 'Adjusted while keeping your flow intact',
        };
    }, [appliedSwapRole]);
    const postSwapHintByRole = useMemo(() => {
        if (!appliedSwapRole || !plan) {
            return {};
        }
        const hintRole = getPostSwapHintRole(appliedSwapRole);
        const hintText = getPostSwapHintText(appliedSwapRole);
        if (!hintRole || !hintText || !plan.itinerary.stops.some((stop) => stop.role === hintRole)) {
            return {};
        }
        return {
            [hintRole]: hintText,
        };
    }, [appliedSwapRole, plan]);
    return (_jsxs(PageShell, { topSlot: _jsx(ID8Butler, { message: "Pick a direction, review your route, and lock tonight when it feels right." }), title: "ID.8 Concierge", subtitle: "Plan tonight in minutes.", children: [_jsxs("div", { className: "demo-flow-frame concierge-flow", children: [_jsx("p", { className: "concierge-context-line", children: "Thoughtfully planned using real-time local context." }), _jsx("section", { className: "preview-adjustments draft-tune-panel", children: _jsxs("div", { className: "preview-adjustments-grid compact", children: [_jsxs("label", { className: "input-group inline-field", children: [_jsx("span", { className: "input-label", children: "Location" }), _jsx("input", { value: "San Jose", readOnly: true, "aria-readonly": "true" })] }), _jsxs("label", { className: "input-group inline-field", children: [_jsx("span", { className: "input-label", children: "Persona" }), _jsx("select", { value: persona, onChange: (event) => setPersona(event.target.value), children: personaOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("label", { className: "input-group inline-field", children: [_jsx("span", { className: "input-label", children: "Vibe" }), _jsx("select", { value: primaryVibe, onChange: (event) => setPrimaryVibe(event.target.value), children: vibeOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] })] }) }), _jsx(RealityCommitStep, { persona: persona, vibe: primaryVibe, selectedCluster: selectedCluster, onSelectCluster: setSelectedCluster, onGenerate: generatePlan, loading: loading }), error && (_jsxs("div", { className: "preview-notice draft-feedback", children: [_jsx("p", { className: "preview-notice-title", children: "Could not generate" }), _jsx("p", { className: "preview-notice-copy", children: error })] })), !hasRevealed && plan && (_jsx("section", { className: "plan-preview", children: _jsxs("article", { className: "night-preview-card", children: [previewImage && (_jsx("div", { className: "night-preview-media", children: _jsx("img", { src: previewImage, alt: highlightStop?.venueName ?? 'Tonight route' }) })), _jsxs("div", { className: "night-preview-content", children: [_jsx("p", { className: "night-preview-kicker", children: "Tonight's route" }), _jsx("p", { className: "concierge-transition-line", children: "Your night is ready." }), _jsx("h3", { children: getPreviewOneLiner(plan.selectedCluster, plan.itinerary) }), _jsx("div", { className: "night-preview-stops", children: previewCoreStops.map((stop) => (_jsx("div", { className: "night-preview-stop-item", children: _jsx("p", { className: "night-preview-stop-description", children: getPreviewStopDescription(stop) }) }, stop.id))) }), _jsx("p", { className: "system-line", children: getPreviewContinuityLine(plan.selectedCluster, plan.itinerary, plan.selectedArc) }), _jsx("div", { className: "action-row draft-actions", children: _jsx("button", { type: "button", className: "primary-button", onClick: () => setHasRevealed(true), children: "Review full route" }) })] })] }) })), hasRevealed && plan && (_jsxs("section", { className: `plan-reveal${isLocking ? ' is-locking' : ''}`, children: [_jsxs("div", { className: "confirm-night-header", children: [_jsx("h2", { children: "Confirm your night" }), _jsx("p", { children: "Take one last look." })] }), _jsx("p", { className: "preview-notice-copy", children: plan.selectedClusterConfirmation }), _jsx(JourneyMapReal, { activeRole: activeRole, routeStops: plan.itinerary.stops.map((stop, stopIndex) => ({
                                    id: stop.id,
                                    role: stop.role,
                                    name: stop.venueName,
                                    displayName: stop.venueName,
                                    stopIndex,
                                })), onNearbySummaryChange: handleNearbySummaryChange }), _jsx(RouteSpine, { className: "draft-story-spine", stops: plan.itinerary.stops, storySpine: plan.itinerary.storySpine, routeHeadline: getPreviewOneLiner(plan.selectedCluster, plan.itinerary), routeWhyLine: getPreviewContinuityLine(plan.selectedCluster, plan.itinerary, plan.selectedArc), usedRecoveredCentralMomentHighlight: Boolean(plan.selectedArc.scoreBreakdown.recoveredCentralMomentHighlight), routeDebugSummary: {
                                    arcType: getRouteArcType(plan.itinerary),
                                    highlightIntensity: getHighlightIntensityFromArc(plan.selectedArc),
                                    usedRecoveredCentralMomentHighlight: Boolean(plan.selectedArc.scoreBreakdown.usedRecoveredCentralMomentHighlight ??
                                        plan.selectedArc.scoreBreakdown.recoveredCentralMomentHighlight),
                                }, allowStopAdjustments: false, enableInlineDetails: true, inlineDetailsByRole: inlineDetailsByRole, appliedSwapNoteByRole: appliedSwapNoteByRole, postSwapHintByRole: postSwapHintByRole, activeRole: activeRole, changedRoles: [], animatedRoles: [], alternativesByRole: {}, alternativeKindsByRole: {}, highlightDecisionSignal: "Chosen over closer options to carry the night better.", onFocusRole: setActiveRole, onShowSwap: () => undefined, onShowNearby: () => undefined, onApplySwap: () => undefined, onPreviewAlternative: handlePreviewAlternative }), _jsx("p", { className: "system-line", children: getBearingsSignal(plan.itinerary) }), appliedSwapRole && (_jsx("p", { className: "system-line swap-global-signal", children: "Your route shifted slightly to keep the night balanced." })), _jsx("p", { className: "system-line", children: "We'll keep your night on track as things shift." }), _jsx("p", { className: "confirm-decision-line", children: isLocking
                                    ? 'Locking it in...'
                                    : 'Ready when you are.' }), _jsxs("div", { className: "action-row draft-actions", children: [_jsx("button", { type: "button", className: "primary-button", onClick: handleLockNight, disabled: isLocking, children: isLocking ? 'Locking it in...' : 'Lock this night' }), _jsx("button", { type: "button", className: "ghost-button", children: "Send to friends" })] })] }))] }), previewSwap && (_jsx("div", { className: "swap-preview-overlay", onClick: () => setPreviewSwap(undefined), role: "presentation", children: _jsxs("article", { className: "swap-preview-popout", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "swap-preview-header", children: [_jsx("p", { className: "swap-preview-kicker", children: "Swap option" }), _jsx("button", { type: "button", className: "ghost-button subtle", onClick: () => setPreviewSwap(undefined), children: "Close" })] }), _jsxs("div", { className: "swap-preview-card", children: [_jsx("div", { className: "swap-preview-image-wrap", children: _jsx("img", { src: previewSwap.candidateStop.imageUrl, alt: previewSwap.candidateStop.venueName }) }), _jsxs("div", { className: "swap-preview-body", children: [_jsx("span", { className: "reveal-story-chip active", children: previewSwap.candidateStop.title }), _jsx("h3", { children: previewSwap.candidateStop.venueName }), _jsx("p", { className: "swap-preview-descriptor", children: previewSwap.descriptor }), _jsxs("p", { className: "stop-card-meta", children: [_jsx("span", { className: "district-name", children: previewSwap.candidateStop.neighborhood }), " |", ' ', previewSwap.candidateStop.driveMinutes, " min out"] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Why it fits" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: previewSwap.whyItFits })] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Known for" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: previewSwap.knownFor })] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Local signal" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: previewSwap.localSignal })] }), _jsxs("div", { className: "swap-preview-impact", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "What changes" }), _jsxs("ul", { className: "swap-preview-impact-list", children: [_jsx("li", { children: previewSwap.tradeoffSignal }), _jsx("li", { children: previewSwap.constraintSignal }), _jsx("li", { children: previewSwap.cascadeHint })] })] }), _jsx("p", { className: "swap-preview-reassure", children: "The rest of your route stays stable." }), _jsxs("div", { className: "swap-preview-actions", children: [_jsxs("a", { className: "stop-card-venue-link", href: previewSwap.venueLinkUrl, target: "_blank", rel: "noreferrer", children: ["Open venue page", ' ->'] }), _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: () => handleKeepCurrentSwap(previewSwap.role), children: "Stay on plan" }), _jsx("button", { type: "button", className: "primary-button", onClick: () => handleApplyPreviewSwap(previewSwap.role), children: "Swap this stop" })] })] })] })] })] }) }))] }));
}
