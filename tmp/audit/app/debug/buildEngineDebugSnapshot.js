import { getArcStopBaseVenueId, getArcStopCandidateId, getScoredVenueBaseVenueId, getScoredVenueCandidateId, getScoredVenueTraceLabel, isHyperlocalActivationVariant, isMomentCandidate, } from '../../domain/candidates/candidateIdentity';
import { getCanonicalDistanceStatus, isCandidateUsedByStretch, isCandidateWithinActiveDistanceWindow, } from '../../domain/constraints/localStretchPolicy';
import { assessRomanticPersonaHighlightQualification, getRomanticPersonaHighlightType, isExpandedRomanticHighlightCandidate, isRomanticPersonaContractActive, requiresRomanticPersonaMoment, satisfiesRomanticPersonaHighlightContract, } from '../../domain/contracts/romanticPersonaContract';
import { getVibeLabel } from '../../domain/types/intent';
import { isHighMomentPotential } from '../../domain/taste/experienceSignals';
function formatNullable(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : 'Not set';
}
function formatYesNo(value) {
    return value ? 'Yes' : 'No';
}
function formatRole(role) {
    if (role === 'start') {
        return 'Start';
    }
    if (role === 'highlight') {
        return 'Highlight';
    }
    if (role === 'surprise') {
        return 'Surprise';
    }
    if (role === 'windDown') {
        return 'Wind Down';
    }
    return 'Not set';
}
function formatInternalRole(role) {
    if (role === 'warmup') {
        return 'Start';
    }
    if (role === 'peak') {
        return 'Highlight';
    }
    if (role === 'wildcard') {
        return 'Surprise';
    }
    return 'Wind Down';
}
function formatRefinements(refinements) {
    return refinements && refinements.length > 0 ? refinements.join(', ') : 'None';
}
function formatPersona(persona) {
    if (persona === 'romantic') {
        return 'Romantic';
    }
    if (persona === 'friends') {
        return 'Friends';
    }
    if (persona === 'family') {
        return 'Family';
    }
    return 'Not set';
}
function buildIntentSummary(intent) {
    const vibeLabel = intent.primaryAnchor ? getVibeLabel(intent.primaryAnchor) : 'No vibe yet';
    const secondary = intent.secondaryAnchors?.[0];
    const secondaryLabel = secondary ? ` + ${getVibeLabel(secondary)}` : '';
    const personaLabel = formatPersona(intent.persona);
    const modeLabel = intent.mode ?? 'build';
    const planningLabel = intent.planningMode ?? 'engine-led';
    const distanceLabel = intent.distanceMode ?? 'nearby';
    return `${vibeLabel}${secondaryLabel} | Persona: ${personaLabel} | ${modeLabel} | ${planningLabel} | ${distanceLabel}`;
}
function mapCategoryLabelToLane(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'restaurant') {
        return 'dining';
    }
    if (normalized === 'bar' || normalized === 'cafe') {
        return 'drinks';
    }
    if (normalized === 'dessert') {
        return 'sweet';
    }
    if (normalized === 'activity') {
        return 'activity';
    }
    if (normalized === 'park') {
        return 'outdoor';
    }
    return 'culture';
}
function increment(counts, key) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
}
function formatExperienceFamily(value) {
    return value.replace(/_/g, ' ');
}
function formatFamilyCompetitionWinnerMode(value) {
    if (value === 'competitive_field_best_family_won') {
        return 'competitive field | lead family held';
    }
    if (value === 'competitive_field_alternate_family_won') {
        return 'competitive field | alternate family won';
    }
    if (value === 'competitive_field_non_competing_family_won') {
        return 'competitive field | winner came from outside the near-equal set';
    }
    if (value === 'clear_family_lead') {
        return 'clear family lead';
    }
    return 'single family only';
}
function formatExpressionWidth(value) {
    if (value === 'broad') {
        return 'Broad';
    }
    if (value === 'moderate') {
        return 'Moderate';
    }
    return 'Narrow';
}
function formatExpressionReleaseSelectionMode(value) {
    if (value === 'competitive_field_lead_held') {
        return 'competitive field | lead held';
    }
    if (value === 'competitive_field_alternate_selected') {
        return 'competitive field | alternate selected';
    }
    if (value === 'clear_winner') {
        return 'clear winner';
    }
    return 'release ineligible';
}
function summarizeDiscoveryDistribution(discoveryGroups) {
    if (!discoveryGroups || discoveryGroups.length === 0) {
        return 'No directions yet';
    }
    const categoryCounts = new Map();
    const laneCounts = new Map();
    for (const direction of discoveryGroups) {
        for (const group of direction.groups) {
            for (const candidate of group.candidates) {
                const category = candidate.categoryLabel.toLowerCase();
                increment(categoryCounts, category);
                increment(laneCounts, mapCategoryLabelToLane(category));
            }
        }
    }
    const categories = [...categoryCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 4)
        .map(([label, count]) => `${label} x${count}`)
        .join(', ');
    const lanes = [...laneCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 4)
        .map(([label, count]) => `${label} x${count}`)
        .join(', ');
    return `Categories: ${categories || 'n/a'} | Lanes: ${lanes || 'n/a'}`;
}
function summarizeRouteDistribution(itinerary) {
    const categoryCounts = new Map();
    const laneCounts = new Map();
    for (const stop of itinerary.stops) {
        increment(categoryCounts, stop.category.toLowerCase());
        increment(laneCounts, mapCategoryLabelToLane(stop.category));
    }
    const categories = [...categoryCounts.entries()]
        .map(([label, count]) => `${label} x${count}`)
        .join(', ');
    const lanes = [...laneCounts.entries()]
        .map(([label, count]) => `${label} x${count}`)
        .join(', ');
    return `Categories: ${categories || 'n/a'} | Lanes: ${lanes || 'n/a'}`;
}
function summarizeArcArchetypeDistribution(arc) {
    const counts = new Map();
    for (const stop of arc.stops) {
        const archetype = stop.scoredVenue.taste.signals.primaryExperienceArchetype;
        increment(counts, archetype);
    }
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([archetype, count]) => `${archetype} x${count}`)
        .join(', ') || 'n/a';
}
function summarizeHighlightArchetype(arc) {
    const highlight = arc.stops.find((stop) => stop.role === 'peak');
    if (!highlight) {
        return 'No highlight';
    }
    const signals = highlight.scoredVenue.taste.signals;
    return `${signals.primaryExperienceArchetype} | ${signals.experienceArchetypes.join(' + ')}`;
}
function summarizeMomentPresence(arc) {
    const highMomentStops = arc.stops.filter((stop) => isHighMomentPotential(stop.scoredVenue.taste.signals.momentPotential));
    if (highMomentStops.length === 0) {
        return 'No';
    }
    return highMomentStops
        .map((stop) => `${formatInternalRole(stop.role)}: ${stop.scoredVenue.venue.name}`)
        .join(' | ');
}
function summarizeMomentBreakdown(arc) {
    return arc.stops
        .map((stop) => {
        const moment = stop.scoredVenue.momentIdentity;
        return `${formatInternalRole(stop.role)} ${moment.type}/${moment.strength}`;
    })
        .join(' | ');
}
function summarizeStrongMomentPresence(arc) {
    return arc.scoreBreakdown.strongMomentPresent ? 'Yes' : 'No';
}
function summarizeMomentVariance(arc) {
    const varianceScore = arc.scoreBreakdown.momentVarianceScore ?? 0;
    if (varianceScore >= 0.66) {
        return 'Good';
    }
    if (varianceScore >= 0.42) {
        return 'Mixed';
    }
    return 'Flat';
}
function summarizeMomentQualityNote(arc) {
    return arc.scoreBreakdown.momentQualityNote ?? 'Moment layer not scored.';
}
function summarizeThemeSpread(arc) {
    const alignedStops = arc.stops.filter((stop) => stop.scoredVenue.taste.modeAlignment.score >= 0.48).length;
    return `${alignedStops} / ${arc.stops.length}`;
}
function summarizeThemeNote(arc) {
    return arc.scoreBreakdown.themeSpreadNote ?? 'highlight-only alignment';
}
function summarizeRomanticSignalsSample(scoredVenues) {
    const topCandidate = [...scoredVenues]
        .sort((left, right) => {
        return (right.taste.signals.romanticScore - left.taste.signals.romanticScore ||
            right.taste.signals.momentPotential.score - left.taste.signals.momentPotential.score ||
            right.fitScore - left.fitScore);
    })[0];
    if (!topCandidate || topCandidate.taste.signals.romanticScore < 0.3) {
        return 'No strong romantic read in current sample';
    }
    const signals = topCandidate.taste.signals.romanticSignals;
    return `${topCandidate.venue.name} | score ${topCandidate.taste.signals.romanticScore.toFixed(2)} | ${topCandidate.taste.signals.romanticFlavor} | i ${signals.intimacy.toFixed(2)} a ${signals.ambiance.toFixed(2)} s ${signals.scenic.toFixed(2)} sh ${signals.sharedActivity.toFixed(2)} am ${signals.ambientExperience.toFixed(2)}`;
}
function summarizeRoleEnergySummary(arc) {
    const warmup = arc.stops.find((stop) => stop.role === 'warmup');
    const highlight = arc.stops.find((stop) => stop.role === 'peak');
    const cooldown = arc.stops.find((stop) => stop.role === 'cooldown');
    if (!warmup || !highlight || !cooldown) {
        return 'n/a';
    }
    return `Start ${warmup.scoredVenue.momentIdentity.type}/${warmup.scoredVenue.momentIdentity.strength} | Highlight ${highlight.scoredVenue.momentIdentity.type}/${highlight.scoredVenue.momentIdentity.strength} | Wind Down ${cooldown.scoredVenue.momentIdentity.type}/${cooldown.scoredVenue.momentIdentity.strength}`;
}
function summarizeRoleEnergyNote(arc) {
    return arc.scoreBreakdown.roleEnergyNote ?? 'flat arc detected';
}
function formatRomanticMomentRole(role) {
    if (!role || role === 'none') {
        return 'none';
    }
    return formatInternalRole(role);
}
function summarizeRomanticFeasibility(arc) {
    const feasibleCount = arc.scoreBreakdown.romanticMomentCandidatesFeasible ?? 0;
    return feasibleCount > 0 ? `Yes | ${feasibleCount}` : 'No';
}
function summarizeRomanticContractOutcome(arc, intentProfile) {
    if (intentProfile.persona !== 'romantic') {
        return 'Not active';
    }
    const feasibleCount = arc.scoreBreakdown.romanticMomentCandidatesFeasible ?? 0;
    const highlight = arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    if (feasibleCount === 0) {
        return 'not enforced (no feasible candidates)';
    }
    if (arc.scoreBreakdown.romanticContractSatisfied) {
        return 'satisfied';
    }
    if (arc.surpriseInjection?.promotionOutcome === 'promoted_to_highlight' &&
        highlight &&
        assessRomanticPersonaHighlightQualification(highlight).qualifies) {
        return 'promoted from surprise';
    }
    if (arc.scoreBreakdown.romanticMomentPresent) {
        return 'enforced';
    }
    return 'held by constraint';
}
function summarizePersonaContractRequiresMoment(lens, intentProfile) {
    if (intentProfile.persona !== 'romantic' || lens.resolvedContract?.persona !== 'romantic') {
        return 'Not active';
    }
    return formatYesNo(Boolean(lens.resolvedContract.highlight.requiresMomentPresence));
}
function summarizePersonaContractPreferredHighlight(lens, intentProfile) {
    if (intentProfile.persona !== 'romantic' || lens.resolvedContract?.persona !== 'romantic') {
        return 'Not active';
    }
    return lens.resolvedContract.highlight.preferredHighlightTypes.join(' / ');
}
function summarizePersonaContractSatisfied(arc, lens, intentProfile) {
    if (intentProfile.persona !== 'romantic' || lens.resolvedContract?.persona !== 'romantic') {
        return 'Not active';
    }
    return formatYesNo(Boolean(arc.scoreBreakdown.romanticContractSatisfied));
}
function summarizeContractBlendMode(lens) {
    return lens.resolvedContract?.blendMode.replace(/_/g, ' ') ?? 'Not active';
}
function summarizeContractResolution(lens) {
    return lens.resolvedContract?.resolutionSummary ?? 'No resolved contract';
}
function summarizeResolvedHighlightRequirements(lens) {
    const highlight = lens.resolvedContract?.highlight;
    if (!highlight) {
        return 'No resolved highlight contract';
    }
    const momentRequirement = highlight.requiresMomentPresence
        ? `moment ${highlight.requireMomentPresenceStrength}`
        : 'moment none';
    const types = highlight.preferredHighlightTypes.length > 0
        ? highlight.preferredHighlightTypes.join(' / ')
        : 'no special types';
    const generic = highlight.discourageGenericHighlight ? 'generic suppressed' : 'generic allowed';
    return `${momentRequirement} | ${types} | ${generic}`;
}
function summarizeResolvedRoleExpectations(lens) {
    const resolved = lens.resolvedContract;
    if (!resolved) {
        return 'No resolved role expectations';
    }
    const start = resolved.rolePreferences.start?.preferredCategories?.slice(0, 3).join('/') ?? 'baseline';
    const highlight = resolved.highlight.preferredCategories.slice(0, 3).join('/') || 'baseline';
    const windDown = resolved.rolePreferences.windDown?.preferredCategories?.slice(0, 3).join('/') ?? 'baseline';
    return `Start ${start} | Highlight ${highlight} | Wind Down ${windDown}`;
}
function summarizeResolvedPacingExpectations(lens) {
    const resolved = lens.resolvedContract;
    if (!resolved) {
        return 'No resolved pacing expectations';
    }
    const tone = lens.tone;
    const energy = lens.energyBand.join('/');
    const movement = lens.movementTolerance;
    const closeToBase = typeof resolved.windDownExpectation.closeToBase === 'boolean'
        ? formatYesNo(resolved.windDownExpectation.closeToBase)
        : formatYesNo(lens.windDownExpectation.closeToBase);
    const windDownEnergy = resolved.windDownExpectation.maxEnergy ?? lens.windDownExpectation.maxEnergy;
    return `Tone ${tone} | energy ${energy} | movement ${movement} | wind down close ${closeToBase} max ${windDownEnergy}`;
}
function summarizeRomanticHighlightArbitration(arc, intentProfile) {
    if (intentProfile.persona !== 'romantic') {
        return 'Not active';
    }
    const result = arc.scoreBreakdown.romanticHighlightArbitrationResult;
    if (result === 'romantic_highlight_won') {
        return 'romantic highlight won';
    }
    if (result === 'generic_cozy_highlight_won') {
        return 'generic cozy highlight won';
    }
    if (result === 'non_generic_highlight_won') {
        return 'non-romantic non-generic highlight won';
    }
    return 'no romantic alternative available';
}
function buildRomanticContractEntries(arc, scoredVenues, intentProfile, lens) {
    const strongestQualifying = getStrongestQualifyingRomanticCandidate(scoredVenues, lens);
    const strongestRejected = getStrongestRejectedRomanticCandidate(arc, scoredVenues, intentProfile, lens);
    const highlight = arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    const strongestQualifyingAssessment = strongestQualifying
        ? assessRomanticPersonaHighlightQualification(strongestQualifying)
        : undefined;
    return [
        {
            label: 'Candidates available',
            value: String(arc.scoreBreakdown.romanticMomentCandidatesAvailable ?? 0),
        },
        {
            label: 'Feasible',
            value: summarizeRomanticFeasibility(arc),
        },
        {
            label: 'Qualifying candidates count',
            value: String(arc.scoreBreakdown.romanticMomentCandidatesAvailable ?? 0),
        },
        {
            label: 'Feasible candidates count',
            value: String(arc.scoreBreakdown.romanticMomentCandidatesFeasible ?? 0),
        },
        {
            label: 'Moment in final arc',
            value: formatYesNo(Boolean(arc.scoreBreakdown.romanticMomentPresent)),
        },
        {
            label: 'Where it landed',
            value: formatRomanticMomentRole(arc.scoreBreakdown.romanticMomentRole),
        },
        {
            label: 'Outcome',
            value: summarizeRomanticContractOutcome(arc, intentProfile),
        },
        {
            label: 'Requires moment',
            value: summarizePersonaContractRequiresMoment(lens, intentProfile),
        },
        {
            label: 'Preferred highlight',
            value: summarizePersonaContractPreferredHighlight(lens, intentProfile),
        },
        {
            label: 'Satisfied',
            value: summarizePersonaContractSatisfied(arc, lens, intentProfile),
        },
        {
            label: 'Highlight arbitration',
            value: summarizeRomanticHighlightArbitration(arc, intentProfile),
        },
        {
            label: 'Qualification expansion active',
            value: summarizeRomanticQualificationExpansionState(scoredVenues, lens),
        },
        {
            label: 'Eligible romantic families',
            value: summarizeEligibleRomanticFamilies(scoredVenues, lens),
        },
        {
            label: 'Newly qualified candidates',
            value: summarizeExpandedRomanticCandidates(scoredVenues, lens),
        },
        {
            label: 'Strongest romantic candidate',
            value: arc.scoreBreakdown.strongestRomanticCandidateName ?? 'None',
        },
        {
            label: 'Strongest qualifying candidate',
            value: strongestQualifying
                ? `${strongestQualifying.venue.name} | ${formatMomentIntensity(strongestQualifying)}`
                : 'None',
        },
        {
            label: 'Qualification reason',
            value: strongestQualifyingAssessment?.reason ?? 'n/a',
        },
        {
            label: 'Strongest blocked candidate',
            value: strongestRejected
                ? `${strongestRejected.venue.name} | ${formatMomentIntensity(strongestRejected)}`
                : 'None',
        },
        {
            label: 'Blocked reason',
            value: strongestRejected
                ? getRomanticContractExcludedReason(strongestRejected, intentProfile, arc, lens)
                : 'n/a',
        },
        {
            label: 'Final highlight',
            value: highlight ? `${highlight.venue.name} | ${formatMomentIntensity(highlight)}` : 'None',
        },
    ];
}
function buildLocalStretchEntries(arc, intentProfile) {
    return [
        {
            label: 'Local supply sufficient',
            value: formatYesNo(Boolean(arc.scoreBreakdown.localSupplySufficient)),
        },
        {
            label: 'Strict nearby failed',
            value: formatYesNo(Boolean(arc.scoreBreakdown.strictNearbyFailed)),
        },
        {
            label: 'Stretch applied',
            value: formatYesNo(Boolean(arc.scoreBreakdown.stretchApplied)),
        },
        {
            label: 'Candidate set basis',
            value: arc.scoreBreakdown.localStretchCandidateSetBasis ??
                'arc scorer unique role-pool candidates after peak feasibility gate',
        },
        {
            label: 'Strict nearby meaningful',
            value: String(arc.scoreBreakdown.strictNearbyMeaningfulCount ?? 0),
        },
        {
            label: 'Bounded stretch meaningful',
            value: String(arc.scoreBreakdown.boundedStretchMeaningfulCount ?? 0),
        },
        {
            label: 'Stretch reason',
            value: arc.scoreBreakdown.stretchReason ?? 'not needed',
        },
        {
            label: 'Local supply derived from',
            value: arc.scoreBreakdown.localSupplyDerivedFrom ??
                (Boolean(arc.scoreBreakdown.localSupplySufficient)
                    ? 'strict nearby count > 0 from canonical nearby set'
                    : 'strict nearby count = 0 in canonical nearby set'),
        },
        {
            label: 'Strict nearby failed from',
            value: arc.scoreBreakdown.strictNearbyFailedDerivedFrom ??
                (Boolean(arc.scoreBreakdown.strictNearbyFailed)
                    ? 'strict nearby count = 0 and bounded stretch count > 0'
                    : 'bounded stretch count = 0 or local strong moment already exists'),
        },
        {
            label: 'Stretched candidate',
            value: arc.scoreBreakdown.stretchedCandidateName ?? 'None',
        },
        {
            label: 'Distance status',
            value: arc.scoreBreakdown.stretchedCandidateDistanceStatus ?? 'n/a',
        },
    ];
}
function hasHighlightAnchorConflict(candidate, intentProfile) {
    if (intentProfile.planningMode !== 'user-led' || !intentProfile.anchor?.venueId) {
        return false;
    }
    const anchorRole = intentProfile.anchor.role ?? 'highlight';
    return (anchorRole === 'highlight' &&
        intentProfile.anchor.venueId !== getScoredVenueBaseVenueId(candidate));
}
function isHighlightRoleValidForRomanticContract(candidate, intentProfile) {
    return (!hasConstraintConflict(candidate) &&
        !hasHighlightAnchorConflict(candidate, intentProfile) &&
        candidate.roleScores.peak >= 0.58 &&
        candidate.stopShapeFit.highlight >= 0.34);
}
function isRomanticContractFeasible(candidate, intentProfile, lens) {
    if (!requiresRomanticPersonaMoment(lens)) {
        return false;
    }
    if (!satisfiesRomanticPersonaHighlightContract(candidate, lens)) {
        return false;
    }
    if (!isDistanceOk(candidate, intentProfile) || !isHoursOk(candidate)) {
        return false;
    }
    return isHighlightRoleValidForRomanticContract(candidate, intentProfile);
}
function getRomanticDistanceStatus(candidate, intentProfile) {
    const status = getCanonicalDistanceStatus(candidate.venue.driveMinutes);
    if (status === 'inside_strict_nearby') {
        return 'inside nearby';
    }
    if (status === 'inside_bounded_stretch') {
        return 'outside nearby | inside bounded stretch';
    }
    if (intentProfile.distanceMode === 'nearby') {
        return 'outside nearby | outside bounded stretch';
    }
    return 'outside nearby';
}
function getRomanticQualificationFailureReason(candidate) {
    const assessment = assessRomanticPersonaHighlightQualification(candidate);
    if (assessment.qualifies) {
        return 'other';
    }
    return assessment.reason;
}
function computeRomanticTracePriority(candidate) {
    const assessment = assessRomanticPersonaHighlightQualification(candidate);
    return (computePeakMomentTraceScore(candidate) * 0.52 +
        candidate.taste.signals.romanticScore * 0.34 +
        candidate.taste.signals.momentIntensity.score * 0.1 +
        candidate.taste.signals.momentPotential.score * 0.04 +
        (assessment.qualifies ? 0.04 : 0) +
        (assessment.expanded ? 0.02 : 0));
}
function isRelevantRomanticTraceCandidate(candidate) {
    const assessment = assessRomanticPersonaHighlightQualification(candidate);
    return (assessment.qualifies ||
        isExpandedRomanticHighlightCandidate(candidate) ||
        candidate.momentIdentity.strength !== 'light' ||
        candidate.taste.signals.momentPotential.score >= 0.52 ||
        candidate.taste.signals.romanticScore >= 0.44);
}
function getRomanticContractExcludedReason(candidate, intentProfile, arc, lens) {
    if (!requiresRomanticPersonaMoment(lens)) {
        return 'contract not active';
    }
    if (!satisfiesRomanticPersonaHighlightContract(candidate, lens)) {
        return getRomanticQualificationFailureReason(candidate);
    }
    if (!isHoursOk(candidate)) {
        return 'hours invalid';
    }
    if (!isCandidateWithinActiveDistanceWindow(candidate, intentProfile, {
        allowMeaningfulStretch: true,
    }) &&
        getCanonicalDistanceStatus(candidate.venue.driveMinutes) === 'outside_bounded_stretch') {
        return 'distance window';
    }
    if (!isHighlightRoleValidForRomanticContract(candidate, intentProfile)) {
        return 'role invalid';
    }
    if (getCanonicalDistanceStatus(candidate.venue.driveMinutes) === 'inside_bounded_stretch' &&
        !isCandidateUsedByStretch(candidate, intentProfile)) {
        return 'local supply gate';
    }
    if (!isDistanceOk(candidate, intentProfile)) {
        return 'distance window';
    }
    return 'other';
}
function summarizeRomanticSignalBreakdown(candidate) {
    const signals = candidate.taste.signals.romanticSignals;
    return `i ${signals.intimacy.toFixed(2)} a ${signals.ambiance.toFixed(2)} s ${signals.scenic.toFixed(2)} sh ${signals.sharedActivity.toFixed(2)} am ${signals.ambientExperience.toFixed(2)}`;
}
function summarizeRomanticQualificationExpansionState(scoredVenues, lens) {
    if (!isRomanticPersonaContractActive(lens)) {
        return 'Not active';
    }
    const expandedCount = scoredVenues.filter((candidate) => isExpandedRomanticHighlightCandidate(candidate)).length;
    return expandedCount > 0 ? `Yes | ${expandedCount} expanded candidates` : 'No';
}
function summarizeExpandedRomanticCandidates(scoredVenues, lens) {
    if (!isRomanticPersonaContractActive(lens)) {
        return 'Not active';
    }
    const expanded = [...scoredVenues]
        .filter((candidate) => isExpandedRomanticHighlightCandidate(candidate))
        .sort((left, right) => {
        return (computeRomanticTracePriority(right) - computeRomanticTracePriority(left) ||
            right.fitScore - left.fitScore);
    })
        .slice(0, 4);
    if (expanded.length === 0) {
        return 'No newly qualified romantic candidates';
    }
    return expanded
        .map((candidate) => {
        const assessment = assessRomanticPersonaHighlightQualification(candidate);
        return (`${candidate.venue.name} | ` +
            `${formatExperienceFamily(candidate.taste.signals.experienceFamily)} | ` +
            `${formatMomentIntensity(candidate)} | ` +
            `${assessment.reason}`);
    })
        .join(' ; ');
}
function summarizeEligibleRomanticFamilies(scoredVenues, lens) {
    if (!isRomanticPersonaContractActive(lens)) {
        return 'Not active';
    }
    const qualifying = scoredVenues.filter((candidate) => satisfiesRomanticPersonaHighlightContract(candidate, lens));
    if (qualifying.length === 0) {
        return 'None';
    }
    return summarizeTopFamilies(qualifying, (candidate) => candidate.taste.signals.experienceFamily);
}
function buildRomanticCandidateTraceEntries(arc, scoredVenues, intentProfile, lens) {
    if (!isRomanticPersonaContractActive(lens)) {
        return [
            {
                label: 'Trace',
                value: 'Persona contract not active',
            },
        ];
    }
    const candidates = scoredVenues
        .filter((candidate) => isRelevantRomanticTraceCandidate(candidate))
        .sort((left, right) => {
        return (computeRomanticTracePriority(right) - computeRomanticTracePriority(left) ||
            right.fitScore - left.fitScore);
    })
        .slice(0, 3);
    if (candidates.length === 0) {
        return [
            {
                label: 'Trace',
                value: 'No relevant moment-capable candidates',
            },
        ];
    }
    return candidates.map((candidate, index) => {
        const assessment = assessRomanticPersonaHighlightQualification(candidate);
        const qualificationStatus = assessment.qualifies ? 'qualifies yes' : 'qualifies no';
        const expansionStatus = assessment.expanded ? 'expanded yes' : 'expanded no';
        return {
            label: `Candidate ${index + 1}`,
            value: `${candidate.venue.name} | ${candidate.momentIdentity.type}/${candidate.momentIdentity.strength} | ` +
                `${formatMomentIntensity(candidate)} | ` +
                `r ${candidate.taste.signals.romanticScore.toFixed(2)} ${candidate.taste.signals.romanticFlavor} | ` +
                `${qualificationStatus} | ${expansionStatus} | ` +
                `contractType ${getRomanticPersonaHighlightType(candidate) ?? 'none'} | ` +
                `${getRomanticDistanceStatus(candidate, intentProfile)} | ` +
                `canonical ${getCanonicalDistanceStatus(candidate.venue.driveMinutes)} | ` +
                `highlight ${formatYesNoCompact(isHighlightRoleValidForRomanticContract(candidate, intentProfile))} | ` +
                `hours ${formatYesNoCompact(isHoursOk(candidate))} | ` +
                `usedByContractFeasibility ${formatYesNoCompact(isCandidateWithinActiveDistanceWindow(candidate, intentProfile, {
                    allowMeaningfulStretch: true,
                }))} | ` +
                `usedByStretch ${formatYesNoCompact(isCandidateUsedByStretch(candidate, intentProfile))} | ` +
                `qualification ${assessment.reason} | ` +
                `${getRomanticContractExcludedReason(candidate, intentProfile, arc, lens)} | ` +
                `${summarizeRomanticSignalBreakdown(candidate)} | ${formatMomentIntensityDrivers(candidate)}`,
        };
    });
}
function getStrongestQualifyingRomanticCandidate(scoredVenues, lens) {
    if (!isRomanticPersonaContractActive(lens)) {
        return undefined;
    }
    return [...scoredVenues]
        .filter((candidate) => satisfiesRomanticPersonaHighlightContract(candidate, lens))
        .sort((left, right) => {
        return (computeRomanticTracePriority(right) - computeRomanticTracePriority(left) ||
            right.fitScore - left.fitScore);
    })[0];
}
function getStrongestRejectedRomanticCandidate(arc, scoredVenues, intentProfile, lens) {
    if (!isRomanticPersonaContractActive(lens)) {
        return undefined;
    }
    return [...scoredVenues]
        .filter((candidate) => isRelevantRomanticTraceCandidate(candidate) &&
        !isRomanticContractFeasible(candidate, intentProfile, lens))
        .sort((left, right) => {
        return (computeRomanticTracePriority(right) - computeRomanticTracePriority(left) ||
            right.fitScore - left.fitScore);
    })[0];
}
function formatMomentScore(value) {
    return value.toFixed(2);
}
function formatMomentIntensity(candidate) {
    return `${candidate.taste.signals.momentIntensity.tier} ${candidate.taste.signals.momentIntensity.score.toFixed(2)}`;
}
function formatMomentIntensityDrivers(candidate) {
    return candidate.taste.signals.momentIntensity.drivers.join(' + ');
}
function formatMomentEnrichmentSignals(candidate) {
    const signals = candidate.taste.signals.momentEnrichment.signals;
    return signals.length > 0 ? signals.join(' + ') : 'no enriched signals';
}
function formatHyperlocalActivationType(value) {
    return value ? value.replace(/_/g, ' ') : 'none';
}
function formatHyperlocalActivation(candidate) {
    const activation = candidate.taste.signals.hyperlocalActivation;
    if (!activation.primaryActivationType) {
        return 'no activation layer';
    }
    const recurrence = activation.recurrenceShape ?? 'none';
    const effect = activation.materiallyChangesHighlightPotential
        ? `material +${activation.intensityContribution.toFixed(2)}`
        : `support +${activation.intensityContribution.toFixed(2)}`;
    const signals = activation.signals.length > 0 ? activation.signals.join(' + ') : 'detected';
    return `${formatHyperlocalActivationType(activation.primaryActivationType)} | ${activation.temporalLabel} | ${recurrence} | ${effect} | ${signals}`;
}
function formatHyperlocalActivationImpact(candidate) {
    const activation = candidate.taste.signals.hyperlocalActivation;
    if (!activation.primaryActivationType) {
        return 'no interpretation impact';
    }
    const impact = activation.interpretationImpact;
    const family = impact.familyRefinements.length > 0 ? impact.familyRefinements.join(' / ') : 'none';
    const changed = activation.materiallyChangesInterpretation ? 'yes' : 'no';
    return (`changed ${changed} | ` +
        `highlight +${impact.highlightSuitability.toFixed(2)} | ` +
        `moment +${impact.momentIntensity.toFixed(2)} | ` +
        `novelty +${impact.novelty.toFixed(2)} | ` +
        `family ${family}`);
}
function formatExperienceFamilyExpansion(candidate) {
    if (!candidate.taste.signals.experienceFamilyExpanded) {
        return `no | ${formatExperienceFamily(candidate.taste.signals.baseExperienceFamily)} held`;
    }
    return (`yes | ${formatExperienceFamily(candidate.taste.signals.baseExperienceFamily)} -> ` +
        `${formatExperienceFamily(candidate.taste.signals.experienceFamily)} | ` +
        `${candidate.taste.signals.experienceFamilyExpansionReason ?? 'activation changed family'}`);
}
function summarizeExpandedFamilyCandidates(scoredVenues) {
    const expanded = [...scoredVenues]
        .filter((candidate) => candidate.taste.signals.experienceFamilyExpanded)
        .sort((left, right) => {
        return (right.taste.signals.hyperlocalActivation.intensityContribution -
            left.taste.signals.hyperlocalActivation.intensityContribution ||
            right.taste.signals.momentIntensity.score - left.taste.signals.momentIntensity.score ||
            right.fitScore - left.fitScore);
    })
        .slice(0, 4);
    if (expanded.length === 0) {
        return 'No activation family expansion';
    }
    return expanded
        .map((candidate) => {
        return (`${getScoredVenueTraceLabel(candidate)} | ` +
            `${formatExperienceFamily(candidate.taste.signals.baseExperienceFamily)} -> ` +
            `${formatExperienceFamily(candidate.taste.signals.experienceFamily)}`);
    })
        .join(' ; ');
}
function formatTemporalRoleAdjustments(candidate) {
    const adjustments = candidate.taste.signals.hyperlocalActivation.temporalCompatibility.roleAdjustments;
    const entries = [
        ['highlight', adjustments.highlight],
        ['surprise', adjustments.surprise],
        ['wind down', adjustments.windDown],
        ['start', adjustments.start],
    ]
        .filter(([, value]) => Math.abs(value) >= 0.005)
        .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));
    if (entries.length === 0) {
        return 'neutral';
    }
    return entries
        .slice(0, 3)
        .map(([label, value]) => `${label} ${value >= 0 ? '+' : ''}${value.toFixed(2)}`)
        .join(' | ');
}
function formatHyperlocalTemporalCompatibility(candidate) {
    const activation = candidate.taste.signals.hyperlocalActivation;
    if (!activation.primaryActivationType) {
        return 'no temporal shaping';
    }
    const temporal = activation.temporalCompatibility;
    const contextWindow = temporal.contextWindow ?? 'none';
    const activationWindow = temporal.activationWindow ?? 'none';
    const changed = temporal.materiallyChangesViability ? 'changed yes' : 'changed no';
    const signals = temporal.signals.length > 0 ? temporal.signals.join(' + ') : 'no temporal cues';
    return (`${temporal.timePresenceState} | context ${contextWindow} -> activation ${activationWindow} | ` +
        `${formatTemporalRoleAdjustments(candidate)} | ${changed} | ${signals}`);
}
function formatMomentElevation(candidate) {
    const eligible = candidate.taste.signals.isElevatedMomentCandidate ? 'yes' : 'no';
    return (`${eligible} | potential ${candidate.taste.signals.momentElevationPotential.toFixed(2)} | ` +
        `${candidate.taste.signals.momentElevationReason ?? 'no elevation signal'}`);
}
function summarizeActivationTemporalFit(scoredVenues) {
    const activated = [...scoredVenues]
        .filter((candidate) => Boolean(candidate.taste.signals.hyperlocalActivation.primaryActivationType))
        .sort((left, right) => {
        const leftActivation = left.taste.signals.hyperlocalActivation;
        const rightActivation = right.taste.signals.hyperlocalActivation;
        return (Number(rightActivation.temporalCompatibility.materiallyChangesViability) -
            Number(leftActivation.temporalCompatibility.materiallyChangesViability) ||
            rightActivation.intensityContribution - leftActivation.intensityContribution ||
            right.fitScore - left.fitScore);
    })
        .slice(0, 3);
    if (activated.length === 0) {
        return 'No activation-shaped temporal fit';
    }
    return activated
        .map((candidate) => {
        const temporal = candidate.taste.signals.hyperlocalActivation.temporalCompatibility;
        return (`${getScoredVenueTraceLabel(candidate)} | ${temporal.timePresenceState} | ` +
            `${temporal.activationWindow ?? 'none'} | ${formatTemporalRoleAdjustments(candidate)}`);
    })
        .join(' ; ');
}
function getInjectedHyperlocalCandidates(scoredVenues) {
    return scoredVenues.filter(isHyperlocalActivationVariant);
}
function getMomentCandidates(scoredVenues) {
    return scoredVenues.filter(isMomentCandidate);
}
function formatMomentCandidateType(candidate) {
    return candidate.candidateIdentity.momentType?.replace(/_/g, ' ') ?? 'unknown';
}
function formatMomentCandidateSource(candidate) {
    return candidate.candidateIdentity.momentSourceType ?? 'unknown';
}
function summarizeMomentCandidateField(scoredVenues, highlightPoolCandidateIds) {
    const moments = getMomentCandidates(scoredVenues);
    if (moments.length === 0) {
        return 'No moment candidates detected';
    }
    const highlightPoolIds = new Set(highlightPoolCandidateIds ?? []);
    return moments
        .slice(0, 5)
        .map((candidate) => {
        const inHighlightPool = highlightPoolIds.has(getScoredVenueCandidateId(candidate));
        return (`${candidate.venue.name} | ${formatMomentCandidateType(candidate)} | ` +
            `${formatMomentCandidateSource(candidate)} | highlight pool ${formatYesNoCompact(inHighlightPool)}`);
    })
        .join(' ; ');
}
function summarizeMomentTypeDistribution(scoredVenues) {
    const moments = getMomentCandidates(scoredVenues);
    if (moments.length === 0) {
        return 'n/a';
    }
    const counts = new Map();
    for (const candidate of moments) {
        const key = formatMomentCandidateType(candidate);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([label, count]) => `${label} x${count}`)
        .join(' | ');
}
function summarizeHyperlocalInjection(scoredVenues, highlightPoolCandidateIds) {
    const injected = getInjectedHyperlocalCandidates(scoredVenues);
    if (injected.length === 0) {
        return 'No injected hyperlocal variants';
    }
    const highlightPoolIds = new Set(highlightPoolCandidateIds ?? []);
    return injected
        .slice(0, 4)
        .map((candidate) => {
        const poolState = highlightPoolIds.has(getScoredVenueCandidateId(candidate))
            ? 'highlight pool'
            : 'scored only';
        return `${getScoredVenueTraceLabel(candidate)} | ${poolState}`;
    })
        .join(' | ');
}
function summarizeHyperlocalInjectionReasons(scoredVenues) {
    const injected = getInjectedHyperlocalCandidates(scoredVenues);
    if (injected.length === 0) {
        return 'n/a';
    }
    return injected
        .slice(0, 3)
        .map((candidate) => {
        const activation = candidate.taste.signals.hyperlocalActivation;
        return (`${candidate.venue.name} -> ${formatHyperlocalActivationType(candidate.candidateIdentity.activationType)}` +
            ` | material ${formatYesNoCompact(activation.materiallyChangesHighlightPotential)}` +
            ` | h+${activation.interpretationImpact.highlightSuitability.toFixed(2)}` +
            ` m+${activation.interpretationImpact.momentIntensity.toFixed(2)}`);
    })
        .join(' | ');
}
function formatYesNoCompact(value) {
    return value ? 'yes' : 'no';
}
function getMomentStrengthWeight(strength) {
    if (strength === 'strong') {
        return 1;
    }
    if (strength === 'medium') {
        return 0.64;
    }
    return 0.28;
}
function getMomentTypeWeight(type) {
    if (type === 'anchor') {
        return 1;
    }
    if (type === 'explore') {
        return 0.88;
    }
    if (type === 'transition') {
        return 0.46;
    }
    if (type === 'linger') {
        return 0.38;
    }
    if (type === 'arrival') {
        return 0.34;
    }
    return 0.3;
}
function computePeakMomentTraceScore(candidate) {
    const validityWeight = candidate.highlightValidity.validityLevel === 'valid'
        ? 1
        : candidate.highlightValidity.validityLevel === 'fallback'
            ? 0.78
            : 0.36;
    return Number((candidate.roleScores.peak * 0.42 +
        candidate.taste.signals.momentPotential.score * 0.24 +
        candidate.taste.signals.momentIntensity.score * 0.22 +
        candidate.taste.signals.anchorStrength * 0.18 +
        getMomentStrengthWeight(candidate.momentIdentity.strength) * 0.1 +
        getMomentTypeWeight(candidate.momentIdentity.type) * 0.06
            *
                validityWeight).toFixed(2));
}
function isHoursOk(candidate) {
    const source = candidate.venue.source;
    if (source.businessStatus === 'temporarily-closed' ||
        source.businessStatus === 'closed-permanently') {
        return false;
    }
    if (source.sourceOrigin === 'live' &&
        source.timeConfidence >= 0.68 &&
        source.likelyOpenForCurrentWindow === false) {
        return false;
    }
    return true;
}
function isDistanceOk(candidate, intentProfile) {
    return isCandidateWithinActiveDistanceWindow(candidate, intentProfile, {
        allowMeaningfulStretch: true,
    });
}
function hasConstraintConflict(candidate) {
    const hardContractConflict = candidate.roleContract.peak.strength === 'hard' && !candidate.roleContract.peak.satisfied;
    return (candidate.highlightValidity.validityLevel === 'invalid' ||
        candidate.highlightValidity.personaVetoes.length > 0 ||
        candidate.highlightValidity.contextVetoes.length > 0 ||
        candidate.highlightValidity.violations.length > 0 ||
        hardContractConflict);
}
function getAssignedRoleLabel(candidate, arc) {
    const stop = arc.stops.find((item) => getArcStopCandidateId(item) === getScoredVenueCandidateId(candidate));
    if (!stop) {
        return 'unused';
    }
    if (stop.role === 'peak') {
        return 'highlight';
    }
    if (stop.role === 'warmup') {
        return 'start';
    }
    if (stop.role === 'wildcard') {
        return 'wildcard';
    }
    return 'unused';
}
function getPeakTraceDecisionReason(params) {
    if (getScoredVenueCandidateId(params.strongest) ===
        getScoredVenueCandidateId(params.finalHighlight)) {
        return `used as highlight on ${formatMomentIntensity(params.finalHighlight)} intensity`;
    }
    const assignedRole = getAssignedRoleLabel(params.strongest, params.arc);
    if (hasConstraintConflict(params.strongest) ||
        !isDistanceOk(params.strongest, params.intentProfile) ||
        !isHoursOk(params.strongest)) {
        return 'blocked by constraint';
    }
    if (assignedRole !== 'unused') {
        return `assigned to different role despite ${formatMomentIntensity(params.strongest)} intensity`;
    }
    if (params.finalHighlight.taste.signals.momentIntensity.score >=
        params.strongest.taste.signals.momentIntensity.score + 0.04) {
        return 'won on higher moment intensity';
    }
    if (params.finalHighlight.roleScores.peak >= params.strongest.roleScores.peak + 0.04 ||
        params.finalHighlight.fitScore >= params.strongest.fitScore + 0.04) {
        return 'downgraded due to score';
    }
    return 'excluded during arc assembly';
}
function buildPeakTraceEntries(arc, scoredVenues, intentProfile) {
    const finalHighlight = arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    if (!finalHighlight || scoredVenues.length === 0) {
        return [
            {
                label: 'Peak trace',
                value: 'No highlight trace available',
            },
        ];
    }
    const strongest = [...scoredVenues].sort((left, right) => {
        return (computePeakMomentTraceScore(right) - computePeakMomentTraceScore(left) ||
            right.roleScores.peak - left.roleScores.peak ||
            right.fitScore - left.fitScore);
    })[0];
    if (!strongest) {
        return [
            {
                label: 'Peak trace',
                value: 'No highlight trace available',
            },
        ];
    }
    const strongestScore = computePeakMomentTraceScore(strongest);
    const finalHighlightScore = computePeakMomentTraceScore(finalHighlight);
    const decisionReason = getPeakTraceDecisionReason({
        strongest,
        strongestScore,
        finalHighlight,
        finalHighlightScore,
        arc,
        intentProfile,
    });
    return [
        {
            label: 'Strongest moment candidate',
            value: `${strongest.venue.name} | ${strongest.momentIdentity.type}/${strongest.momentIdentity.strength} | ${formatMomentIntensity(strongest)} | ${formatMomentScore(strongestScore)}`,
        },
        {
            label: 'Final highlight',
            value: `${finalHighlight.venue.name} | ${finalHighlight.momentIdentity.type}/${finalHighlight.momentIdentity.strength} | ${formatMomentIntensity(finalHighlight)} | ${formatMomentScore(finalHighlightScore)}`,
        },
        {
            label: 'Candidate comparison',
            value: `Delta ${formatMomentScore(finalHighlightScore - strongestScore)} | intensity ${formatMomentIntensity(finalHighlight)} vs ${formatMomentIntensity(strongest)} | strongest as ${getAssignedRoleLabel(strongest, arc)}`,
        },
        {
            label: 'Winning intensity drivers',
            value: formatMomentIntensityDrivers(finalHighlight),
        },
        {
            label: 'Decision reason',
            value: decisionReason,
        },
        {
            label: 'Feasibility flags',
            value: `Distance ${formatYesNoCompact(isDistanceOk(strongest, intentProfile))} | Hours ${formatYesNoCompact(isHoursOk(strongest))} | Constraint conflict ${formatYesNoCompact(hasConstraintConflict(strongest))}`,
        },
    ];
}
function buildSurprisePromotionEntries(arc) {
    const promotionNote = arc.surpriseInjection?.promotionNote;
    if (!promotionNote) {
        return [];
    }
    return [
        {
            label: 'Surprise promotion',
            value: promotionNote,
        },
    ];
}
function summarizeRedundancyPenalty(arc) {
    const penalty = arc.scoreBreakdown.categoryDiversityPenalty ?? 0;
    if (penalty <= 0) {
        return 'No';
    }
    const topNote = arc.scoreBreakdown.categoryDiversityNotes?.[0];
    return topNote ? `Yes | ${topNote}` : `Yes | ${(penalty * 100).toFixed(1)}`;
}
function summarizeFallbackSuppression(arc) {
    if (!(arc.scoreBreakdown.fallbackHighlightSignal ?? 0)) {
        return 'Not eligible';
    }
    if (!(arc.scoreBreakdown.fallbackHighlightPenaltyApplied ?? false)) {
        return 'No | no stronger highlight alternative available';
    }
    const penalty = arc.scoreBreakdown.fallbackHighlightPenalty ?? 0;
    const strongerAlternative = arc.scoreBreakdown.fallbackHighlightAlternativeName;
    return strongerAlternative
        ? `Yes | ${strongerAlternative} available (${penalty.toFixed(2)})`
        : `Yes | ${(penalty * 100).toFixed(1)}`;
}
function summarizeFallbackSuppressionReason(arc) {
    if (!(arc.scoreBreakdown.fallbackHighlightSignal ?? 0)) {
        return 'candidate not eligible for fallback suppression';
    }
    return arc.scoreBreakdown.fallbackHighlightReason ?? 'no stronger highlight alternative available';
}
function summarizeSuppressedFallbackCandidates(scoredVenues) {
    const suppressed = scoredVenues
        .filter((candidate) => candidate.taste.fallbackPenalty.applied)
        .sort((left, right) => right.taste.fallbackPenalty.appliedPenalty - left.taste.fallbackPenalty.appliedPenalty)
        .slice(0, 3);
    if (suppressed.length === 0) {
        return 'None';
    }
    return suppressed
        .map((candidate) => `${candidate.venue.name} -> ${candidate.taste.fallbackPenalty.strongerAlternativeName ?? 'stronger alternative'} (${candidate.taste.fallbackPenalty.appliedPenalty.toFixed(2)})`)
        .join(' | ');
}
function getHighlightSampleCandidates(scoredVenues, limit = 24) {
    return [...scoredVenues]
        .sort((left, right) => {
        return (right.roleScores.peak - left.roleScores.peak ||
            right.fitScore - left.fitScore ||
            right.stopShapeFit.highlight - left.stopShapeFit.highlight);
    })
        .slice(0, limit);
}
function isDebugHighlightFeasibleCandidate(candidate, intentProfile) {
    return (candidate.highlightValidity.validityLevel !== 'invalid' &&
        !hasConstraintConflict(candidate) &&
        !hasHighlightAnchorConflict(candidate, intentProfile) &&
        isDistanceOk(candidate, intentProfile) &&
        isHoursOk(candidate) &&
        candidate.roleScores.peak >= 0.56 &&
        candidate.stopShapeFit.highlight >= 0.32);
}
function satisfiesResolvedHighlightContract(candidate, lens) {
    if (!requiresRomanticPersonaMoment(lens)) {
        return true;
    }
    return satisfiesRomanticPersonaHighlightContract(candidate, lens);
}
function isLowIntensityHighlightCandidate(candidate) {
    return (candidate.taste.signals.momentIntensity.tier === 'standard' &&
        candidate.taste.signals.momentPotential.score < 0.62);
}
function summarizeTopFamilies(candidates, selector, limit = 3) {
    if (candidates.length === 0) {
        return 'None';
    }
    const counts = new Map();
    for (const candidate of candidates) {
        increment(counts, selector(candidate));
    }
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([label, count]) => `${formatExperienceFamily(label)} x${count}`)
        .join(', ');
}
function summarizeDistributionRecord(distribution, limit = 4) {
    if (!distribution || Object.keys(distribution).length === 0) {
        return 'None';
    }
    return Object.entries(distribution)
        .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0) || left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([label, count]) => `${formatExperienceFamily(label)} x${count ?? 0}`)
        .join(', ');
}
function summarizeDominantFamily(distribution) {
    if (!distribution || Object.keys(distribution).length === 0) {
        return 'No';
    }
    const entries = Object.entries(distribution).sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0) || left[0].localeCompare(right[0]));
    const top = entries[0];
    const total = entries.reduce((sum, [, count]) => sum + (count ?? 0), 0);
    if (!top || total === 0) {
        return 'No';
    }
    const share = (top[1] ?? 0) / total;
    return share >= 0.6 ? `Yes | ${formatExperienceFamily(top[0])} ${Math.round(share * 100)}%` : 'No';
}
function summarizeFamilyCompetitionState(arc) {
    if (!arc.scoreBreakdown.familyCompetitionActive) {
        return `No | ${formatFamilyCompetitionWinnerMode(arc.scoreBreakdown.familyCompetitionWinnerMode)}`;
    }
    return `Yes | ${formatFamilyCompetitionWinnerMode(arc.scoreBreakdown.familyCompetitionWinnerMode)}`;
}
function summarizeFamilyCompetitionFamilies(arc) {
    const families = arc.scoreBreakdown.familyCompetitionEligibleFamilies ?? [];
    if (families.length === 0) {
        return 'None';
    }
    return families.map((family) => formatExperienceFamily(family)).join(' / ');
}
function summarizeFamilyCompetitionSpread(arc) {
    const spread = arc.scoreBreakdown.familyCompetitionTopSpread;
    const threshold = arc.scoreBreakdown.familyCompetitionThreshold;
    if (typeof threshold !== 'number') {
        return 'n/a';
    }
    return `spread ${(spread ?? 0).toFixed(2)} | threshold ${threshold.toFixed(2)}`;
}
function summarizeExpressionWidth(arc) {
    return formatExpressionWidth(arc.scoreBreakdown.expressionWidth);
}
function summarizeExpressionWidthBasis(arc, generationTrace) {
    const familyCount = arc.scoreBreakdown.expressionWidthFamilyCount ?? 0;
    const competitiveFamilyCount = arc.scoreBreakdown.expressionWidthCompetitiveFamilyCount ?? 0;
    const peakPoolSize = arc.scoreBreakdown.expressionWidthPeakPoolSize ?? 0;
    const fallbackReliance = arc.scoreBreakdown.expressionWidthFallbackReliance;
    return `${familyCount} families | ${competitiveFamilyCount} competitive | peak pool ${peakPoolSize} | ${generationTrace.candidateArcCount} arcs | ${fallbackReliance ? 'fallback relied on' : 'no fallback reliance'}`;
}
function summarizeExpressionWidthOutcome(arc) {
    const width = formatExpressionWidth(arc.scoreBreakdown.expressionWidth).toLowerCase();
    const finalHighlight = arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    if (!finalHighlight) {
        return `${width} field | no highlight selected`;
    }
    return `${width} field | ${formatExperienceFamily(finalHighlight.taste.signals.experienceFamily)} won`;
}
function summarizeExpressionReleaseEligibility(arc) {
    if (!arc.scoreBreakdown.expressionReleaseEligible) {
        return `No | ${arc.scoreBreakdown.expressionReleaseReason ?? 'not eligible'}`;
    }
    return `Yes | ${arc.scoreBreakdown.expressionReleaseReason ?? 'competitive field eligible'}`;
}
function summarizeExpressionReleaseEliteSet(arc) {
    const names = arc.scoreBreakdown.expressionReleaseEliteCandidateNames ?? [];
    const families = arc.scoreBreakdown.expressionReleaseEliteFamilies ?? [];
    const lanes = arc.scoreBreakdown.eliteFieldCandidateLanes ?? [];
    if (names.length === 0) {
        return 'None';
    }
    return names
        .map((name, index) => `${name} | ${formatExperienceFamily(families[index] ?? 'unknown')} | ${lanes[index]?.replace(/_/g, ' / ') ?? 'unknown'}`)
        .join(' ; ');
}
function summarizeExpressionReleaseSelectionMode(arc) {
    return formatExpressionReleaseSelectionMode(arc.scoreBreakdown.expressionReleaseSelectionMode);
}
function summarizeExpressionReleaseDecision(arc) {
    const decision = arc.scoreBreakdown.expressionReleaseDecision;
    const selectedCandidate = arc.scoreBreakdown.expressionReleaseSelectedCandidateName;
    const selectedFamily = arc.scoreBreakdown.expressionReleaseSelectedFamily;
    if (!decision) {
        return 'No release decision recorded';
    }
    if (!selectedCandidate) {
        return decision;
    }
    return `${decision} | ${formatExperienceFamily(selectedFamily ?? 'unknown')}`;
}
function summarizeActivationMomentElevationEligibility(arc) {
    if (!arc.scoreBreakdown.activationMomentElevationEligible) {
        return `No | ${arc.scoreBreakdown.activationMomentElevationReason ?? 'not eligible'}`;
    }
    return `Yes | ${arc.scoreBreakdown.activationMomentElevationReason ?? 'competitive field eligible'}`;
}
function summarizeActivationMomentElevationCandidates(arc) {
    const names = arc.scoreBreakdown.activationMomentElevationCandidateNames ?? [];
    const families = arc.scoreBreakdown.activationMomentElevationCandidateFamilies ?? [];
    if (names.length === 0) {
        return 'None';
    }
    return names
        .map((name, index) => `${name} | ${formatExperienceFamily(families[index] ?? 'unknown')}`)
        .join(' ; ');
}
function summarizeActivationMomentElevationApplied(arc) {
    const applied = arc.scoreBreakdown.activationMomentElevationApplied ? 'Yes' : 'No';
    const topCandidate = arc.scoreBreakdown.activationMomentElevationTopCandidateName;
    const topPotential = arc.scoreBreakdown.activationMomentElevationTopCandidatePotential;
    const winnerElevated = arc.scoreBreakdown.activationMomentElevationWinnerElevated
        ? 'winner elevated'
        : 'winner not elevated';
    if (!topCandidate) {
        return `${applied} | ${winnerElevated}`;
    }
    return (`${applied} | ${winnerElevated} | ${topCandidate} | ` +
        `potential ${(topPotential ?? 0).toFixed(2)}`);
}
function summarizeEliteFieldDiversification(arc) {
    if (!arc.scoreBreakdown.eliteFieldDiversified) {
        return `No | ${arc.scoreBreakdown.eliteFieldDiversificationReason ?? 'not applied'}`;
    }
    return `Yes | ${arc.scoreBreakdown.eliteFieldDiversificationReason ?? 'lane-aware elite field'}`;
}
function summarizeEliteFieldLanes(arc) {
    const lanes = arc.scoreBreakdown.eliteFieldDetectedLanes ?? [];
    if (lanes.length === 0) {
        return 'None';
    }
    return lanes.map((lane) => lane.replace(/_/g, ' / ')).join(' ; ');
}
function summarizeEliteFieldLaneCandidates(arc) {
    const candidates = arc.scoreBreakdown.eliteFieldLaneCandidates ?? [];
    if (candidates.length === 0) {
        return 'None';
    }
    return candidates
        .map((entry) => {
        const [lane, candidate] = entry.split(' => ');
        return `${lane.replace(/_/g, ' / ')} | ${candidate ?? 'n/a'}`;
    })
        .join(' ; ');
}
function buildCandidateShapingEntries(params) {
    const highlightDiagnostics = params.generationTrace.rolePoolDiagnostics.highlight;
    const sample = getHighlightSampleCandidates(params.scoredVenues);
    let contractMismatch = 0;
    let fallbackSuppression = 0;
    let lowIntensity = 0;
    let feasibility = 0;
    for (const candidate of sample) {
        if (!satisfiesResolvedHighlightContract(candidate, params.lens)) {
            contractMismatch += 1;
            continue;
        }
        if (!isDebugHighlightFeasibleCandidate(candidate, params.intentProfile)) {
            feasibility += 1;
            continue;
        }
        if (candidate.taste.fallbackPenalty.applied) {
            fallbackSuppression += 1;
            continue;
        }
        if (isLowIntensityHighlightCandidate(candidate)) {
            lowIntensity += 1;
        }
    }
    const qualifying = sample.filter((candidate) => satisfiesResolvedHighlightContract(candidate, params.lens) &&
        isDebugHighlightFeasibleCandidate(candidate, params.intentProfile));
    return [
        {
            label: 'Counts',
            value: `${params.generationTrace.scoredVenueCount} scored -> ${highlightDiagnostics?.contractStrictCandidateCount ?? 'n/a'} contract-strict -> ${highlightDiagnostics?.rolePoolSize ?? 'n/a'} highlight pool -> ${params.generationTrace.candidateArcCount} arcs`,
        },
        {
            label: 'Moment candidates detected',
            value: `${getMomentCandidates(params.scoredVenues).length} | ${summarizeMomentTypeDistribution(params.scoredVenues)}`,
        },
        {
            label: 'Moment highlight pool',
            value: summarizeMomentCandidateField(params.scoredVenues, highlightDiagnostics?.rolePoolCandidateIds),
        },
        {
            label: 'Scored families',
            value: summarizeTopFamilies(params.scoredVenues, (candidate) => candidate.taste.signals.experienceFamily, 5),
        },
        {
            label: 'Highlight pool families',
            value: summarizeDistributionRecord(highlightDiagnostics?.familyDistribution),
        },
        {
            label: 'Narrowing pressures',
            value: `contract ${contractMismatch} | fallback ${fallbackSuppression} | low intensity ${lowIntensity} | feasibility ${feasibility}`,
        },
        {
            label: 'Pool validity',
            value: highlightDiagnostics
                ? `valid ${highlightDiagnostics.highlightValidCandidateCount ?? 0} | fallback ${highlightDiagnostics.highlightFallbackCandidateCount ?? 0} | invalid ${highlightDiagnostics.highlightInvalidCandidateCount ?? 0}`
                : 'n/a',
        },
        {
            label: 'Pool relaxation',
            value: highlightDiagnostics?.contractRelaxed && highlightDiagnostics.contractFallbackReason
                ? highlightDiagnostics.contractFallbackReason
                : 'No contract relaxation',
        },
        {
            label: 'Activation temporal fit',
            value: summarizeActivationTemporalFit(params.scoredVenues),
        },
        {
            label: 'Surviving lanes',
            value: summarizeTopFamilies(qualifying, (candidate) => candidate.taste.modeAlignment.lane),
        },
        {
            label: 'Surviving families',
            value: highlightDiagnostics?.familyDistribution && Object.keys(highlightDiagnostics.familyDistribution).length > 0
                ? summarizeDistributionRecord(highlightDiagnostics.familyDistribution)
                : summarizeTopFamilies(qualifying, (candidate) => candidate.taste.signals.experienceFamily),
        },
        {
            label: 'Elite field diversification',
            value: summarizeEliteFieldDiversification(params.arc),
        },
        {
            label: 'Detected lanes',
            value: summarizeEliteFieldLanes(params.arc),
        },
        {
            label: 'Lane candidates',
            value: summarizeEliteFieldLaneCandidates(params.arc),
        },
        {
            label: 'Hyperlocal family expansion',
            value: summarizeExpandedFamilyCandidates(params.scoredVenues),
        },
        {
            label: 'Elevated moments',
            value: summarizeActivationMomentElevationCandidates(params.arc),
        },
        {
            label: 'Highlight-capable expansion',
            value: summarizeEnrichmentPromotedCandidates(params.scoredVenues, params.intentProfile, params.lens),
        },
        {
            label: 'Activation layer',
            value: summarizeActivationPromotedCandidates(params.scoredVenues, params.intentProfile, params.lens),
        },
        {
            label: 'Hyperlocal injection',
            value: summarizeHyperlocalInjection(params.scoredVenues, highlightDiagnostics?.rolePoolCandidateIds),
        },
        {
            label: 'Injection reason',
            value: summarizeHyperlocalInjectionReasons(params.scoredVenues),
        },
        {
            label: 'Family expansion',
            value: summarizeEnrichmentExpandedFamilies(params.scoredVenues, params.intentProfile, params.lens),
        },
        {
            label: 'Dominant family',
            value: summarizeDominantFamily(highlightDiagnostics?.familyDistribution),
        },
        {
            label: 'Surviving archetypes',
            value: summarizeTopFamilies(qualifying, (candidate) => candidate.taste.signals.primaryExperienceArchetype),
        },
    ];
}
function inferSelectedDirection(discoveryGroups, selectedVenueIds, fallbackVenueIds = []) {
    if (!discoveryGroups || discoveryGroups.length === 0) {
        return undefined;
    }
    const targets = selectedVenueIds.length > 0 ? selectedVenueIds : fallbackVenueIds;
    if (targets.length === 0) {
        return discoveryGroups[0];
    }
    return [...discoveryGroups]
        .map((direction, index) => {
        const candidateIds = direction.groups.flatMap((group) => group.candidates.map((candidate) => candidate.venueId));
        const overlap = candidateIds.filter((venueId) => targets.includes(venueId)).length;
        return {
            direction,
            overlap,
            index,
        };
    })
        .sort((left, right) => right.overlap - left.overlap || left.index - right.index)[0]?.direction;
}
function buildDirectionArcSummary(direction) {
    if (!direction) {
        return 'No direction selected yet';
    }
    return direction.groups
        .map((group) => {
        const firstCandidate = group.candidates[0];
        return firstCandidate ? `${group.title}: ${firstCandidate.name}` : undefined;
    })
        .filter((value) => Boolean(value))
        .join(' | ');
}
function buildDraftArcSummary(itinerary) {
    return itinerary.stops.map((stop) => `${stop.title}: ${stop.venueName}`).join(' | ');
}
function summarizeConstraintTrace(trace) {
    if (!trace || trace.length === 0) {
        return 'No hard constraints recorded';
    }
    return trace
        .filter((entry) => entry.priority === 'hard' || entry.priority === 'user')
        .slice(0, 3)
        .map((entry) => `${entry.type}: ${entry.decision}`)
        .join(' | ') || 'No hard constraints recorded';
}
function buildTasteEntries(lens, distribution) {
    const tasteMode = lens?.tasteMode;
    return [
        {
            label: 'Taste Mode',
            value: tasteMode ? tasteMode.label : 'Not selected yet',
        },
        {
            label: 'Why',
            value: tasteMode?.reason ?? 'Taste Mode appears after a primary vibe is available.',
        },
        {
            label: 'Bias',
            value: tasteMode?.biasSummary ?? 'Waiting for interpretation handoff.',
        },
        {
            label: 'Top aligned lanes',
            value: tasteMode ? tasteMode.favoredLanes.join(' > ') : 'Not available yet',
        },
        {
            label: 'Deprioritized lanes',
            value: tasteMode && tasteMode.discouragedLanes.length > 0
                ? tasteMode.discouragedLanes.join(' > ')
                : 'None',
        },
        {
            label: 'Enforcement',
            value: tasteMode
                ? `${tasteMode.enforcementStrength} | weight ${tasteMode.alignmentWeight.toFixed(2)}`
                : 'Not available yet',
        },
        {
            label: 'Distribution',
            value: distribution,
        },
    ];
}
function summarizeCandidateAlignment(scoredVenues) {
    const sample = scoredVenues.slice(0, 24);
    if (sample.length === 0) {
        return 'No scored candidates';
    }
    const primary = sample.filter((item) => item.taste.modeAlignment.tier === 'primary').length;
    const supporting = sample.filter((item) => item.taste.modeAlignment.tier === 'supporting').length;
    const fallback = sample.filter((item) => item.taste.modeAlignment.tier === 'fallback').length;
    const misaligned = sample.filter((item) => item.taste.modeAlignment.tier === 'misaligned').length;
    return `Top 24 after shaping | strong aligned ${primary}, light aligned ${supporting}, fallback ${fallback}, misaligned ${misaligned}`;
}
function summarizeAlignedLanes(scoredVenues) {
    const sample = scoredVenues.slice(0, 24);
    if (sample.length === 0) {
        return 'No scored candidates';
    }
    const counts = new Map();
    for (const item of sample) {
        increment(counts, item.taste.modeAlignment.lane);
    }
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 4)
        .map(([lane, count]) => `${lane} x${count}`)
        .join(', ');
}
function summarizeFinalArcAlignment(arc) {
    const alignedStops = arc.stops.filter((stop) => stop.scoredVenue.taste.modeAlignment.score >= 0.48);
    const strongAlignedStops = arc.stops.filter((stop) => stop.scoredVenue.taste.modeAlignment.score >= 0.68 ||
        stop.scoredVenue.taste.modeAlignment.tier === 'primary');
    const lightAlignedStops = Math.max(0, alignedStops.length - strongAlignedStops.length);
    return `Aligned stops ${alignedStops.length} | strong ${strongAlignedStops.length} | light ${lightAlignedStops} | score ${(arc.scoreBreakdown.tasteModeAlignmentScore ?? 0).toFixed(2)}`;
}
function summarizeAlignmentAvailability(arc) {
    const availableStrong = arc.scoreBreakdown.tasteModeAvailableStrongCount ?? 0;
    const availableAligned = arc.scoreBreakdown.tasteModeAvailableAlignedCount ?? 0;
    const availableLight = Math.max(0, availableAligned - availableStrong);
    if (availableStrong > 0) {
        return `Yes | strong ${availableStrong} | light ${availableLight}`;
    }
    if (availableAligned > 0) {
        return `Yes | strong 0 | light ${availableLight || availableAligned}`;
    }
    return 'No aligned candidates available';
}
function summarizeAlignmentSatisfiedStops(arc) {
    const alignedStops = arc.stops.filter((stop) => stop.scoredVenue.taste.modeAlignment.score >= 0.48);
    if (alignedStops.length === 0) {
        return 'None';
    }
    return alignedStops
        .map((stop) => `${formatInternalRole(stop.role)}: ${stop.scoredVenue.venue.name}`)
        .join(' | ');
}
function buildAlignmentOutcomeNote(arc) {
    const availableAligned = arc.scoreBreakdown.tasteModeAvailableAlignedCount ?? 0;
    const availableStrong = arc.scoreBreakdown.tasteModeAvailableStrongCount ?? 0;
    const strongAligned = arc.scoreBreakdown.tasteModeStrongAlignedStopCount ?? 0;
    const aligned = arc.scoreBreakdown.tasteModeAlignedStopCount ?? 0;
    if (availableStrong === 0 && availableAligned === 0) {
        return 'Fallback won because no aligned candidates were available';
    }
    if (strongAligned > 0) {
        return 'Alignment preserved with strong contract fit';
    }
    if (availableStrong > 0 && aligned > 0) {
        return 'Strong alignment was available, but the arc only kept light alignment';
    }
    if (aligned > 0) {
        return 'Fallback won because no strong aligned candidate was available';
    }
    if (availableStrong > 0) {
        return 'Alignment lost (fallback selected despite strong aligned availability)';
    }
    return 'Alignment lost (fallback selected)';
}
function computeHighlightDecisionPriority(candidate, lens, intentProfile) {
    return (computePeakMomentTraceScore(candidate) +
        (satisfiesResolvedHighlightContract(candidate, lens) ? 0.18 : 0) +
        candidate.taste.modeAlignment.score * 0.08 +
        (isDebugHighlightFeasibleCandidate(candidate, intentProfile) ? 0.06 : -0.18) -
        candidate.taste.fallbackPenalty.appliedPenalty * 0.4);
}
function getHighlightAlternativeLossReason(candidate, finalHighlight, arc, intentProfile, lens) {
    if (getScoredVenueCandidateId(candidate) === getScoredVenueCandidateId(finalHighlight)) {
        return 'selected winner';
    }
    if (!satisfiesResolvedHighlightContract(candidate, lens)) {
        return 'contract mismatch';
    }
    if (candidate.taste.fallbackPenalty.applied) {
        return candidate.taste.fallbackPenalty.reason;
    }
    if (!isHoursOk(candidate)) {
        return 'hours invalid';
    }
    if (!isDistanceOk(candidate, intentProfile)) {
        return 'distance window';
    }
    if (hasConstraintConflict(candidate)) {
        return 'constraint conflict';
    }
    const assignedRole = getAssignedRoleLabel(candidate, arc);
    if (assignedRole !== 'unused') {
        return `used as ${assignedRole}`;
    }
    if (finalHighlight.taste.signals.momentIntensity.score >=
        candidate.taste.signals.momentIntensity.score + 0.03) {
        return 'weaker moment intensity';
    }
    if (finalHighlight.roleScores.peak >= candidate.roleScores.peak + 0.04) {
        return 'lower peak fit';
    }
    if (finalHighlight.fitScore >= candidate.fitScore + 0.04) {
        return 'lower overall fit';
    }
    return 'lost in final arc assembly';
}
function summarizeWinningDrivers(finalHighlight, lens, arc) {
    const drivers = [];
    if (requiresRomanticPersonaMoment(lens) && satisfiesResolvedHighlightContract(finalHighlight, lens)) {
        drivers.push('contract aligned');
    }
    if (finalHighlight.highlightValidity.validityLevel === 'valid') {
        drivers.push('valid highlight');
    }
    if (finalHighlight.taste.modeAlignment.tier === 'primary') {
        drivers.push(`lane ${finalHighlight.taste.modeAlignment.lane}`);
    }
    if (arc?.scoreBreakdown.familyCompetitionActive &&
        (arc.scoreBreakdown.familyCompetitionEligibleFamilies ?? []).includes(finalHighlight.taste.signals.experienceFamily)) {
        drivers.push('won competitive family field');
    }
    if (arc?.scoreBreakdown.expressionReleaseEligible &&
        arc.scoreBreakdown.expressionReleaseSelectedCandidateName === finalHighlight.venue.name) {
        drivers.push('won elite release set');
    }
    drivers.push(`intensity ${formatMomentIntensity(finalHighlight)}`);
    const intensityDrivers = formatMomentIntensityDrivers(finalHighlight);
    if (intensityDrivers) {
        drivers.push(intensityDrivers);
    }
    return drivers.join(' | ');
}
function getTopQualifyingHighlightCandidates(scoredVenues, intentProfile, lens) {
    return [...scoredVenues]
        .filter((candidate) => satisfiesResolvedHighlightContract(candidate, lens) &&
        isDebugHighlightFeasibleCandidate(candidate, intentProfile))
        .sort((left, right) => {
        return (computeHighlightDecisionPriority(right, lens, intentProfile) -
            computeHighlightDecisionPriority(left, lens, intentProfile) ||
            right.fitScore - left.fitScore);
    })
        .slice(0, 3);
}
function isEnrichmentPromotedHighlightCandidate(candidate, intentProfile, lens) {
    const enrichment = candidate.taste.signals.momentEnrichment;
    return (enrichment.signals.length > 0 &&
        enrichment.highlightSurfaceBoost >= 0.18 &&
        candidate.taste.signals.momentPotential.score >= 0.58 &&
        candidate.taste.signals.momentIntensity.score >= 0.62 &&
        satisfiesResolvedHighlightContract(candidate, lens) &&
        isDebugHighlightFeasibleCandidate(candidate, intentProfile));
}
function isActivationPromotedHighlightCandidate(candidate, intentProfile, lens) {
    const activation = candidate.taste.signals.hyperlocalActivation;
    return (Boolean(activation.primaryActivationType) &&
        activation.materiallyChangesInterpretation &&
        activation.interpretationImpact.highlightSuitability >= 0.03 &&
        candidate.taste.signals.momentIntensity.score >= 0.58 &&
        candidate.fitScore >= 0.72);
}
function summarizeEnrichmentPromotedCandidates(scoredVenues, intentProfile, lens) {
    const promoted = [...scoredVenues]
        .filter((candidate) => isEnrichmentPromotedHighlightCandidate(candidate, intentProfile, lens))
        .sort((left, right) => {
        return (right.taste.signals.momentEnrichment.highlightSurfaceBoost -
            left.taste.signals.momentEnrichment.highlightSurfaceBoost ||
            right.taste.signals.momentIntensity.score -
                left.taste.signals.momentIntensity.score ||
            right.fitScore - left.fitScore);
    })
        .slice(0, 4);
    if (promoted.length === 0) {
        return 'No enrichment-promoted highlight candidates';
    }
    return promoted
        .map((candidate) => `${candidate.venue.name} | ${formatExperienceFamily(candidate.taste.signals.experienceFamily)} | boost ${candidate.taste.signals.momentEnrichment.highlightSurfaceBoost.toFixed(2)}`)
        .join(' ; ');
}
function summarizeEnrichmentExpandedFamilies(scoredVenues, intentProfile, lens) {
    const promoted = scoredVenues.filter((candidate) => isEnrichmentPromotedHighlightCandidate(candidate, intentProfile, lens));
    if (promoted.length === 0) {
        return 'No enriched family expansion yet';
    }
    return summarizeTopFamilies(promoted, (candidate) => candidate.taste.signals.experienceFamily);
}
function summarizeActivationPromotedCandidates(scoredVenues, intentProfile, lens) {
    const promoted = [...scoredVenues]
        .filter((candidate) => isActivationPromotedHighlightCandidate(candidate, intentProfile, lens))
        .sort((left, right) => {
        return (right.taste.signals.hyperlocalActivation.intensityContribution -
            left.taste.signals.hyperlocalActivation.intensityContribution ||
            right.taste.signals.momentIntensity.score - left.taste.signals.momentIntensity.score ||
            right.fitScore - left.fitScore);
    })
        .slice(0, 4);
    if (promoted.length === 0) {
        return 'No activation-shaped highlight lift';
    }
    return promoted
        .map((candidate) => {
        const activation = candidate.taste.signals.hyperlocalActivation;
        return (`${candidate.venue.name} | ` +
            `${formatHyperlocalActivationType(activation.primaryActivationType)} | ` +
            `lift ${activation.intensityContribution.toFixed(2)}`);
    })
        .join(' ; ');
}
function getStrongestBlockedHighlightCandidate(scoredVenues, intentProfile, lens) {
    return [...scoredVenues]
        .filter((candidate) => !(satisfiesResolvedHighlightContract(candidate, lens) &&
        isDebugHighlightFeasibleCandidate(candidate, intentProfile)))
        .sort((left, right) => {
        return (computeHighlightDecisionPriority(right, lens, intentProfile) -
            computeHighlightDecisionPriority(left, lens, intentProfile) ||
            right.fitScore - left.fitScore);
    })[0];
}
function buildHighlightDecisionEntries(params) {
    const finalHighlight = params.arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    if (!finalHighlight) {
        return [
            {
                label: 'Decision',
                value: 'No highlight selected',
            },
        ];
    }
    const strongest = [...params.scoredVenues].sort((left, right) => {
        return (computeHighlightDecisionPriority(right, params.lens, params.intentProfile) -
            computeHighlightDecisionPriority(left, params.lens, params.intentProfile) ||
            right.fitScore - left.fitScore);
    })[0];
    const topQualifying = getTopQualifyingHighlightCandidates(params.scoredVenues, params.intentProfile, params.lens);
    const blocked = getStrongestBlockedHighlightCandidate(params.scoredVenues, params.intentProfile, params.lens);
    return [
        {
            label: 'Strongest candidate',
            value: strongest
                ? `${strongest.venue.name} | ${formatExperienceFamily(strongest.taste.signals.experienceFamily)} | ${strongest.taste.signals.primaryExperienceArchetype} | ${formatMomentIntensity(strongest)}`
                : 'n/a',
        },
        {
            label: 'Final highlight',
            value: `${getScoredVenueTraceLabel(finalHighlight)} | ${formatExperienceFamily(finalHighlight.taste.signals.experienceFamily)} | ${finalHighlight.taste.signals.primaryExperienceArchetype} | ${formatMomentIntensity(finalHighlight)}`,
        },
        {
            label: 'Final highlight is moment',
            value: isMomentCandidate(finalHighlight)
                ? `yes | ${formatMomentCandidateType(finalHighlight)} | ${formatMomentCandidateSource(finalHighlight)}`
                : 'no',
        },
        {
            label: strongest &&
                getScoredVenueCandidateId(strongest) ===
                    getScoredVenueCandidateId(finalHighlight)
                ? 'Strongest preserved'
                : 'Why strongest lost',
            value: strongest
                ? getHighlightAlternativeLossReason(strongest, finalHighlight, params.arc, params.intentProfile, params.lens)
                : 'n/a',
        },
        ...topQualifying.map((candidate, index) => ({
            label: `Top ${index + 1}`,
            value: `${candidate.venue.name} | ${formatExperienceFamily(candidate.taste.signals.experienceFamily)} | ${candidate.taste.signals.primaryExperienceArchetype} | ` +
                `${formatMomentIntensity(candidate)} | ${getHighlightAlternativeLossReason(candidate, finalHighlight, params.arc, params.intentProfile, params.lens)}`,
        })),
        {
            label: 'Strongest blocked alternative',
            value: blocked
                ? `${blocked.venue.name} | ${formatExperienceFamily(blocked.taste.signals.experienceFamily)} | ${getHighlightAlternativeLossReason(blocked, finalHighlight, params.arc, params.intentProfile, params.lens)}`
                : 'None',
        },
        {
            label: 'Family competition',
            value: summarizeFamilyCompetitionState(params.arc),
        },
        {
            label: 'Eligible families',
            value: summarizeFamilyCompetitionFamilies(params.arc),
        },
        {
            label: 'Enriched moment signals',
            value: formatMomentEnrichmentSignals(finalHighlight),
        },
        {
            label: 'Hyperlocal activation',
            value: formatHyperlocalActivation(finalHighlight),
        },
        {
            label: 'Activation impact',
            value: formatHyperlocalActivationImpact(finalHighlight),
        },
        {
            label: 'Family expansion',
            value: formatExperienceFamilyExpansion(finalHighlight),
        },
        {
            label: 'Moment elevation',
            value: formatMomentElevation(finalHighlight),
        },
        {
            label: 'Temporal compatibility',
            value: formatHyperlocalTemporalCompatibility(finalHighlight),
        },
        {
            label: 'Elevation eligible',
            value: summarizeActivationMomentElevationEligibility(params.arc),
        },
        {
            label: 'Elevation applied',
            value: summarizeActivationMomentElevationApplied(params.arc),
        },
        {
            label: 'Elite field',
            value: summarizeEliteFieldDiversification(params.arc),
        },
        {
            label: 'Release eligible',
            value: summarizeExpressionReleaseEligibility(params.arc),
        },
        {
            label: 'Elite set',
            value: summarizeExpressionReleaseEliteSet(params.arc),
        },
        {
            label: 'Selection mode',
            value: summarizeExpressionReleaseSelectionMode(params.arc),
        },
        {
            label: 'Release decision',
            value: summarizeExpressionReleaseDecision(params.arc),
        },
        {
            label: 'Winning drivers',
            value: summarizeWinningDrivers(finalHighlight, params.lens, params.arc),
        },
    ];
}
function buildExpressionCompressionEntries(params) {
    const sample = [...params.scoredVenues]
        .filter((candidate) => satisfiesResolvedHighlightContract(candidate, params.lens) &&
        isDebugHighlightFeasibleCandidate(candidate, params.intentProfile))
        .sort((left, right) => {
        return (computeHighlightDecisionPriority(right, params.lens, params.intentProfile) -
            computeHighlightDecisionPriority(left, params.lens, params.intentProfile) ||
            right.fitScore - left.fitScore);
    });
    const topScore = sample[0]
        ? computeHighlightDecisionPriority(sample[0], params.lens, params.intentProfile)
        : 0;
    const thirdScore = sample[2]
        ? computeHighlightDecisionPriority(sample[2], params.lens, params.intentProfile)
        : sample[0]
            ? computeHighlightDecisionPriority(sample[sample.length - 1], params.lens, params.intentProfile)
            : 0;
    const maxIntensity = sample[0]
        ? Math.max(...sample.slice(0, 5).map((candidate) => candidate.taste.signals.momentIntensity.score))
        : 0;
    const minIntensity = sample[0]
        ? Math.min(...sample.slice(0, 5).map((candidate) => candidate.taste.signals.momentIntensity.score))
        : 0;
    const families = new Set(sample.slice(0, 8).map((candidate) => candidate.taste.signals.experienceFamily));
    const lanes = new Map();
    for (const candidate of sample.slice(0, 8)) {
        increment(lanes, candidate.taste.modeAlignment.lane);
    }
    const dominantLane = [...lanes.entries()].sort((left, right) => right[1] - left[1])[0];
    const dominantShare = dominantLane && sample.slice(0, 8).length > 0
        ? dominantLane[1] / sample.slice(0, 8).length
        : 0;
    const strongest = sample[0];
    const finalHighlight = params.arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    return [
        {
            label: 'Expression width',
            value: summarizeExpressionWidth(params.arc),
        },
        {
            label: 'Width basis',
            value: params.arc.scoreBreakdown.expressionWidthReason ??
                summarizeExpressionWidthBasis(params.arc, params.generationTrace),
        },
        {
            label: 'Top-candidate spread',
            value: sample.length >= 2
                ? `${(topScore - thirdScore).toFixed(2)} across top ${Math.min(3, sample.length)}`
                : 'Single viable candidate',
        },
        {
            label: 'Intensity spread',
            value: typeof params.arc.scoreBreakdown.expressionWidthIntensitySpread === 'number'
                ? `${params.arc.scoreBreakdown.expressionWidthIntensitySpread.toFixed(2)} among family leaders`
                : sample.length > 0
                    ? `${minIntensity.toFixed(2)} -> ${maxIntensity.toFixed(2)}`
                    : 'n/a',
        },
        {
            label: 'Viable highlight families',
            value: `${families.size} | ${summarizeTopFamilies(sample.slice(0, 8), (candidate) => candidate.taste.signals.experienceFamily)}`,
        },
        {
            label: 'Family competition',
            value: summarizeFamilyCompetitionState(params.arc),
        },
        {
            label: 'Expression release',
            value: summarizeExpressionReleaseEligibility(params.arc),
        },
        {
            label: 'Near-equal family read',
            value: summarizeFamilyCompetitionSpread(params.arc),
        },
        {
            label: 'Field breadth',
            value: summarizeExpressionWidthBasis(params.arc, params.generationTrace),
        },
        {
            label: 'Dominant lane',
            value: dominantLane && dominantShare >= 0.6
                ? `Yes | ${dominantLane[0]} ${Math.round(dominantShare * 100)}%`
                : dominantLane
                    ? `No | ${dominantLane[0]} leads`
                    : 'n/a',
        },
        {
            label: 'Arc narrowing',
            value: strongest && finalHighlight
                ? getScoredVenueCandidateId(strongest) ===
                    getScoredVenueCandidateId(finalHighlight)
                    ? 'Preserved leading expression'
                    : strongest.taste.signals.primaryExperienceArchetype ===
                        finalHighlight.taste.signals.primaryExperienceArchetype
                        ? `Changed winner within ${finalHighlight.taste.signals.primaryExperienceArchetype}`
                        : `Changed from ${strongest.taste.signals.primaryExperienceArchetype} to ${finalHighlight.taste.signals.primaryExperienceArchetype}`
                : buildAlignmentOutcomeNote(params.arc),
        },
        {
            label: 'Outcome field',
            value: summarizeExpressionWidthOutcome(params.arc),
        },
    ];
}
function summarizeFinalFallbackRoles(arc) {
    const fallbackStops = arc.stops.filter((stop) => stop.scoredVenue.taste.fallbackPenalty.signalScore > 0 &&
        !stop.scoredVenue.taste.fallbackPenalty.applied);
    if (fallbackStops.length === 0) {
        return 'No fallback-style stop survived without suppression';
    }
    return fallbackStops
        .map((stop) => `${formatInternalRole(stop.role)} ${stop.scoredVenue.venue.name}`)
        .join(' | ');
}
function buildFallbackTraceEntries(params) {
    const suppressedCount = params.scoredVenues.filter((candidate) => candidate.taste.fallbackPenalty.applied).length;
    return [
        {
            label: 'Highlight suppression',
            value: summarizeFallbackSuppression(params.arc),
        },
        {
            label: 'Suppressed count',
            value: String(suppressedCount),
        },
        {
            label: 'Suppressed candidates',
            value: summarizeSuppressedFallbackCandidates(params.scoredVenues),
        },
        {
            label: 'Suppression reason',
            value: summarizeFallbackSuppressionReason(params.arc),
        },
        {
            label: 'Fallback survived in final arc',
            value: summarizeFinalFallbackRoles(params.arc),
        },
    ];
}
function buildFinalArcPreservationEntries(params) {
    const finalHighlight = params.arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    const strongest = [...params.scoredVenues].sort((left, right) => {
        return (computeHighlightDecisionPriority(right, params.lens, params.intentProfile) -
            computeHighlightDecisionPriority(left, params.lens, params.intentProfile) ||
            right.fitScore - left.fitScore);
    })[0];
    const strongestRole = strongest && finalHighlight ? getAssignedRoleLabel(strongest, params.arc) : 'unused';
    const contractPreserved = !requiresRomanticPersonaMoment(params.lens) ||
        Boolean(params.arc.scoreBreakdown.romanticContractSatisfied);
    return [
        {
            label: 'Strongest aligned candidate',
            value: strongest ? strongest.venue.name : 'n/a',
        },
        {
            label: 'Survived to final arc',
            value: strongest && strongestRole !== 'unused'
                ? `Yes | ${strongestRole}`
                : 'No',
        },
        {
            label: 'Assembly effect',
            value: strongest &&
                finalHighlight &&
                getScoredVenueCandidateId(strongest) ===
                    getScoredVenueCandidateId(finalHighlight)
                ? 'Preserved leading expression'
                : strongest
                    ? `Changed from ${strongest.taste.signals.primaryExperienceArchetype} to ${finalHighlight?.taste.signals.primaryExperienceArchetype ?? 'n/a'}`
                    : 'n/a',
        },
        {
            label: 'Contract fit',
            value: requiresRomanticPersonaMoment(params.lens)
                ? contractPreserved
                    ? 'Preserved'
                    : 'Diluted'
                : 'No persona contract active',
        },
        {
            label: 'Alignment preservation',
            value: buildAlignmentOutcomeNote(params.arc),
        },
        {
            label: 'Route feel',
            value: `${params.arc.pacing.routeFeelLabel} | ${params.arc.pacing.estimatedTotalLabel}`,
        },
    ];
}
export function buildExploreDebugSnapshot(params) {
    const selectedDirection = inferSelectedDirection(params.discoveryGroups, params.selectedVenueIds);
    const selectedPocketLabel = selectedDirection?.pocketLabel;
    const alternatePocketUsed = selectedPocketLabel
        ? selectedPocketLabel.toLowerCase() !==
            (params.intentDraft.neighborhood ?? '').toLowerCase()
        : false;
    return {
        summary: 'Dev only. Trace Interpretation -> Taste -> District -> Bearings -> Waypoint.',
        sections: [
            {
                title: 'Interpretation',
                entries: [
                    {
                        label: 'Primary / Secondary',
                        value: params.intentDraft.primaryVibe
                            ? `${getVibeLabel(params.intentDraft.primaryVibe)}${params.intentDraft.secondaryVibe
                                ? ` + ${getVibeLabel(params.intentDraft.secondaryVibe)}`
                                : ''}`
                            : 'Not set yet',
                    },
                    {
                        label: 'Persona modifier',
                        value: formatPersona(params.intentDraft.persona),
                    },
                    {
                        label: 'Intent summary',
                        value: buildIntentSummary({
                            primaryAnchor: params.intentProfile?.primaryAnchor,
                            secondaryAnchors: params.intentProfile?.secondaryAnchors,
                            persona: params.intentProfile?.persona ?? params.intentDraft.persona,
                            mode: params.intentProfile?.mode,
                            planningMode: params.intentProfile?.planningMode,
                            distanceMode: params.intentProfile?.distanceMode ?? params.intentDraft.distanceMode,
                        }),
                    },
                    {
                        label: 'Persona effect',
                        value: params.lens?.interpretation?.personaEffectSummary ??
                            'Waiting for a primary vibe before interpretation runs.',
                    },
                    {
                        label: 'Derived traits',
                        value: `Refinements: ${formatRefinements(params.intentProfile?.refinementModes)} | Hidden gems: ${formatYesNo(params.intentProfile?.prefersHiddenGems ?? params.intentDraft.prefersHiddenGems)}`,
                    },
                ],
            },
            {
                title: 'Taste',
                entries: buildTasteEntries(params.lens, summarizeDiscoveryDistribution(params.discoveryGroups)),
            },
            {
                title: 'District',
                entries: [
                    {
                        label: 'City / Area hint',
                        value: `${params.intentDraft.city} / ${formatNullable(params.intentDraft.neighborhood)}`,
                    },
                    {
                        label: 'Pocket strategy',
                        value: alternatePocketUsed
                            ? `Alternate pocket in play: ${selectedPocketLabel}`
                            : selectedPocketLabel
                                ? `Staying in: ${selectedPocketLabel}`
                                : 'No pocket strategy active yet',
                    },
                ],
            },
            {
                title: 'Bearings',
                entries: [
                    {
                        label: 'Anchor present',
                        value: params.anchorName
                            ? `Yes | ${params.anchorName}`
                            : 'No',
                    },
                    {
                        label: 'Explicit time',
                        value: params.intentDraft.startTime ? `Yes | ${params.intentDraft.startTime}` : 'No',
                    },
                    {
                        label: 'Major constraints',
                        value: `Distance: ${params.intentDraft.distanceMode} | Planning: ${params.intentProfile?.planningMode ?? params.intentDraft.planningMode ?? 'engine-led'}`,
                    },
                ],
            },
            {
                title: 'Waypoint',
                entries: [
                    {
                        label: 'Current direction',
                        value: selectedDirection
                            ? `${selectedDirection.title}${selectedDirection.pocketLabel ? ` | ${selectedDirection.pocketLabel}` : ''}`
                            : 'No direction yet',
                    },
                    {
                        label: 'Arc summary',
                        value: buildDirectionArcSummary(selectedDirection),
                    },
                ],
            },
        ],
    };
}
export function buildDraftDebugSnapshot(params) {
    const selectedDirection = inferSelectedDirection(params.discoveryGroups, params.selectedVenueIds, params.itinerary.stops.map((stop) => stop.venueId));
    const itineraryNeighborhoods = [...new Set(params.itinerary.stops.map((stop) => stop.neighborhood))];
    return {
        summary: 'Dev only. Use this to see where Taste, district choice, and constraints shaped the draft.',
        sections: [
            {
                title: 'Interpretation',
                entries: [
                    {
                        label: 'Primary / Secondary',
                        value: `${getVibeLabel(params.intentProfile.primaryAnchor)}${params.intentProfile.secondaryAnchors?.[0]
                            ? ` + ${getVibeLabel(params.intentProfile.secondaryAnchors[0])}`
                            : ''}`,
                    },
                    {
                        label: 'Persona modifier',
                        value: formatPersona(params.intentProfile.persona),
                    },
                    {
                        label: 'Intent summary',
                        value: buildIntentSummary(params.intentProfile),
                    },
                    {
                        label: 'Persona effect',
                        value: params.lens.interpretation?.personaEffectSummary ?? 'No persona modifier applied.',
                    },
                    {
                        label: 'Derived traits',
                        value: `Refinements: ${formatRefinements(params.intentProfile.refinementModes)} | Hidden gems: ${formatYesNo(params.intentProfile.prefersHiddenGems)}`,
                    },
                ],
            },
            {
                title: 'Resolved contract',
                entries: [
                    {
                        label: 'Primary vibe',
                        value: getVibeLabel(params.intentProfile.primaryAnchor),
                    },
                    {
                        label: 'Persona',
                        value: params.lens.resolvedContract?.persona ?? 'Vibe only',
                    },
                    {
                        label: 'Blend mode',
                        value: summarizeContractBlendMode(params.lens),
                    },
                    {
                        label: 'Resolution',
                        value: summarizeContractResolution(params.lens),
                    },
                    {
                        label: 'Highlight requirements',
                        value: summarizeResolvedHighlightRequirements(params.lens),
                    },
                    {
                        label: 'Role expectations',
                        value: summarizeResolvedRoleExpectations(params.lens),
                    },
                    {
                        label: 'Pacing expectations',
                        value: summarizeResolvedPacingExpectations(params.lens),
                    },
                    {
                        label: 'Enforcement',
                        value: params.lens.tasteMode
                            ? `${params.lens.tasteMode.enforcementStrength} | weight ${params.lens.tasteMode.alignmentWeight.toFixed(2)}`
                            : 'n/a',
                    },
                    {
                        label: 'Contract satisfied',
                        value: summarizePersonaContractSatisfied(params.arc, params.lens, params.intentProfile),
                    },
                ],
            },
            ...(isRomanticPersonaContractActive(params.lens)
                ? [
                    {
                        title: 'Romantic contract',
                        entries: buildRomanticContractEntries(params.arc, params.scoredVenues, params.intentProfile, params.lens),
                    },
                    {
                        title: 'Romantic candidate trace',
                        entries: buildRomanticCandidateTraceEntries(params.arc, params.scoredVenues, params.intentProfile, params.lens),
                    },
                ]
                : []),
            {
                title: 'Candidate shaping',
                entries: buildCandidateShapingEntries({
                    arc: params.arc,
                    scoredVenues: params.scoredVenues,
                    intentProfile: params.intentProfile,
                    lens: params.lens,
                    generationTrace: params.generationTrace,
                }),
            },
            {
                title: 'Highlight decision',
                entries: buildHighlightDecisionEntries({
                    arc: params.arc,
                    scoredVenues: params.scoredVenues,
                    intentProfile: params.intentProfile,
                    lens: params.lens,
                }),
            },
            {
                title: 'Expression compression',
                entries: buildExpressionCompressionEntries({
                    arc: params.arc,
                    scoredVenues: params.scoredVenues,
                    intentProfile: params.intentProfile,
                    lens: params.lens,
                    generationTrace: params.generationTrace,
                }),
            },
            {
                title: 'Fallback trace',
                entries: buildFallbackTraceEntries({
                    arc: params.arc,
                    scoredVenues: params.scoredVenues,
                }),
            },
            {
                title: 'Final arc preservation',
                entries: buildFinalArcPreservationEntries({
                    arc: params.arc,
                    scoredVenues: params.scoredVenues,
                    intentProfile: params.intentProfile,
                    lens: params.lens,
                }),
            },
            {
                title: 'Local Stretch',
                entries: buildLocalStretchEntries(params.arc, params.intentProfile),
            },
            {
                title: 'District',
                entries: [
                    {
                        label: 'City / Area hint',
                        value: `${params.intentProfile.city} / ${formatNullable(params.intentProfile.neighborhood)}`,
                    },
                    {
                        label: 'District influence',
                        value: `${params.generationTrace.selectedDistrictLabel} | ${params.generationTrace.selectedDistrictSource}`,
                    },
                    {
                        label: 'Pocket spread',
                        value: itineraryNeighborhoods.length > 1
                            ? `${itineraryNeighborhoods.join(' -> ')}`
                            : itineraryNeighborhoods[0] ?? 'n/a',
                    },
                ],
            },
            {
                title: 'Bearings',
                entries: [
                    {
                        label: 'Anchor present',
                        value: params.anchorName
                            ? `Yes | ${params.anchorName} | ${formatRole(params.intentProfile.anchor?.role)}`
                            : 'No',
                    },
                    {
                        label: 'Explicit time',
                        value: params.intentProfile.timeWindow
                            ? `Yes | ${params.intentProfile.timeWindow}`
                            : 'No',
                    },
                    {
                        label: 'Major constraints',
                        value: summarizeConstraintTrace(params.generationTrace.constraintTrace),
                    },
                ],
            },
            {
                title: 'Waypoint',
                entries: [
                    {
                        label: 'Direction / strategy',
                        value: selectedDirection
                            ? `${selectedDirection.title}${selectedDirection.pocketLabel ? ` | ${selectedDirection.pocketLabel}` : ''}`
                            : 'Draft generated without a retained discovery direction',
                    },
                    {
                        label: 'Arc summary',
                        value: buildDraftArcSummary(params.itinerary),
                    },
                ],
            },
        ],
    };
}
