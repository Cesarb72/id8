import { computeRoleAwareLiveLift } from '../retrieval/computeRoleAwareLiveLift';
import { computeSpatialCoherence } from '../spatial/computeSpatialCoherence';
import { computeRouteDuration } from '../taste/computeRouteDuration';
import { computeRouteShapeBias } from '../taste/computeRouteShapeBias';
import { computeSupportStopVibeFit } from '../taste/computeSupportStopVibeFit';
import { isCandidateWithinActiveDistanceWindow, isCandidateUsedByStretch, getStretchDistanceStatus, isMeaningfulMomentStretchCandidate, isOutsideStrictNearbyButWithinBoundedStretch, isWithinStrictNearbyWindow, } from '../constraints/localStretchPolicy';
import { assessGenericHospitalityFallbackPenalty, getArchetypeRepeatTolerance, getMomentIntensityRank, getMomentIntensityTierBoost, isGenericHospitalityFallbackCandidate, isHighMomentPotential, isStrongMomentIdentity, } from '../taste/experienceSignals';
import { detectExperienceFamily } from '../directions/detectExperienceFamily';
import { assessRomanticPersonaHighlightQualification, getRomanticPersonaHighlightType, requiresRomanticPersonaMoment, satisfiesRomanticPersonaHighlightContract, } from '../contracts/romanticPersonaContract';
import { getArcStopBaseVenueId, getArcStopCandidateId, getScoredVenueBaseVenueId, getScoredVenueCandidateId, getScoredVenueTraceLabel, } from '../candidates/candidateIdentity';
import { getRolePoolForRole } from './buildRolePools';
const HIGHLIGHT_DOMINANCE_THRESHOLD = 0.72;
const HIGHLIGHT_DOMINANCE_BOOST = 0.08;
const HIGHLIGHT_WEAK_PENALTY = 0.06;
const FAMILY_ALIGNMENT_BOOST = 0.05;
const FAMILY_MISMATCH_PENALTY = 0.05;
const BAD_BUILD_PENALTY = 0.05;
const FAMILY_ALIGNMENT_CONFIDENCE_MIN = 0.58;
const ARC_VIABILITY_HIGHLIGHT_THRESHOLD = 0.6;
const FAKE_COMPLETENESS_PENALTY = 0.08;
function getPrimaryExperienceArchetype(stop) {
    return stop.scoredVenue.taste.signals.primaryExperienceArchetype;
}
function isHospitalityArchetype(archetype) {
    return archetype === 'dining' || archetype === 'drinks' || archetype === 'sweet';
}
function getMomentIdentity(stop) {
    return stop.scoredVenue.momentIdentity;
}
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function normalizeArcTotalScore(value) {
    if (value <= 0) {
        return 0;
    }
    if (value <= 0.88) {
        return value;
    }
    return value / (1 + value - 0.88);
}
export function isArcViable(input) {
    return (input.hasHighlight &&
        input.highlightIntensity >= ARC_VIABILITY_HIGHLIGHT_THRESHOLD &&
        input.supportingStopsCount >= 1);
}
function getPeakMomentStrengthWeight(strength) {
    if (strength === 'strong') {
        return 1;
    }
    if (strength === 'medium') {
        return 0.64;
    }
    return 0.28;
}
function getPeakMomentTypeWeight(type) {
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
function computePeakMomentLeadScore(candidate) {
    const validityWeight = candidate.highlightValidity.validityLevel === 'valid'
        ? 1
        : candidate.highlightValidity.validityLevel === 'fallback'
            ? 0.78
            : 0.36;
    return (candidate.roleScores.peak * 0.42 +
        candidate.taste.signals.momentPotential.score * 0.24 +
        candidate.taste.signals.momentIntensity.score * 0.22 +
        getMomentIntensityTierBoost(candidate.taste.signals.momentIntensity) * 0.9 +
        candidate.taste.signals.anchorStrength * 0.18 +
        getPeakMomentStrengthWeight(candidate.momentIdentity.strength) * 0.1 +
        getPeakMomentTypeWeight(candidate.momentIdentity.type) * 0.06) * validityWeight;
}
function getUniqueRolePoolCandidates(rolePools) {
    if (!rolePools) {
        return [];
    }
    return [
        ...new Map([
            ...rolePools.warmup,
            ...rolePools.peak,
            ...rolePools.wildcard,
            ...rolePools.cooldown,
        ].map((candidate) => [getScoredVenueCandidateId(candidate), candidate])).values(),
    ];
}
function isPeakHoursOk(candidate) {
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
function isPeakDistanceOk(candidate, intent) {
    return isCandidateWithinActiveDistanceWindow(candidate, intent, {
        allowMeaningfulStretch: true,
    });
}
function hasPeakConstraintConflict(candidate) {
    const hardContractConflict = candidate.roleContract.peak.strength === 'hard' && !candidate.roleContract.peak.satisfied;
    return (candidate.highlightValidity.validityLevel === 'invalid' ||
        candidate.highlightValidity.personaVetoes.length > 0 ||
        candidate.highlightValidity.contextVetoes.length > 0 ||
        candidate.highlightValidity.violations.length > 0 ||
        hardContractConflict);
}
function hasPeakAnchorConflict(candidate, intent) {
    if (intent.planningMode !== 'user-led' || !intent.anchor?.venueId) {
        return false;
    }
    const anchorRole = intent.anchor.role ?? 'highlight';
    return (anchorRole === 'highlight' &&
        intent.anchor.venueId !== getScoredVenueBaseVenueId(candidate));
}
function isFeasiblePeakMomentLeadCandidate(candidate, intent) {
    const peakTypedMoment = candidate.momentIdentity.type === 'anchor' ||
        candidate.momentIdentity.type === 'explore';
    const strongMomentLead = candidate.momentIdentity.strength === 'strong' ||
        candidate.taste.signals.momentPotential.score >= 0.72;
    return (peakTypedMoment &&
        strongMomentLead &&
        candidate.roleScores.peak >= 0.6 &&
        candidate.stopShapeFit.highlight >= 0.36 &&
        !hasPeakAnchorConflict(candidate, intent) &&
        isPeakDistanceOk(candidate, intent) &&
        isPeakHoursOk(candidate) &&
        !hasPeakConstraintConflict(candidate));
}
function isWarmupAnchorConflict(candidate, intent) {
    if (intent.planningMode !== 'user-led' || !intent.anchor?.venueId) {
        return false;
    }
    const anchorRole = intent.anchor.role ?? 'highlight';
    return anchorRole === 'start' && intent.anchor.venueId !== getScoredVenueBaseVenueId(candidate);
}
function computeRomanticMomentLeadScore(candidate) {
    const archetype = candidate.taste.signals.primaryExperienceArchetype;
    const experientialArchetypeLift = archetype === 'activity' || archetype === 'scenic'
        ? 0.12
        : archetype === 'outdoor' || archetype === 'culture'
            ? 0.08
            : archetype === 'social'
                ? 0.05
                : 0;
    const hospitalityPenalty = isHospitalityArchetype(archetype) ? 0.12 : 0;
    return (computePeakMomentLeadScore(candidate) +
        candidate.taste.signals.momentPotential.score * 0.04 +
        candidate.taste.signals.momentIntensity.score * 0.1 +
        experientialArchetypeLift -
        hospitalityPenalty);
}
function isFeasibleRomanticMomentCandidate(candidate, intent) {
    if (!assessRomanticPersonaHighlightQualification(candidate).qualifies) {
        return false;
    }
    if (!isPeakDistanceOk(candidate, intent) || !isPeakHoursOk(candidate)) {
        return false;
    }
    const highlightFeasible = !hasPeakAnchorConflict(candidate, intent) &&
        !hasPeakConstraintConflict(candidate) &&
        candidate.roleScores.peak >= 0.58 &&
        candidate.stopShapeFit.highlight >= 0.34;
    const warmupFeasible = !isWarmupAnchorConflict(candidate, intent) &&
        candidate.roleScores.warmup >= 0.56 &&
        candidate.stopShapeFit.start >= 0.3 &&
        candidate.momentIdentity.type !== 'close';
    const wildcardFeasible = candidate.roleScores.wildcard >= 0.57 && candidate.stopShapeFit.surprise >= 0.44;
    return highlightFeasible || warmupFeasible || wildcardFeasible;
}
function isFeasibleRomanticHighlightCandidate(candidate, lens, intent) {
    return (satisfiesRomanticPersonaHighlightContract(candidate, lens) &&
        !hasPeakAnchorConflict(candidate, intent) &&
        isPeakDistanceOk(candidate, intent) &&
        isPeakHoursOk(candidate) &&
        !hasPeakConstraintConflict(candidate) &&
        candidate.roleScores.peak >= 0.58 &&
        candidate.stopShapeFit.highlight >= 0.34);
}
function isGenericHospitalityHighlightCandidate(candidate) {
    const archetype = candidate.taste.signals.primaryExperienceArchetype;
    return (archetype === 'dining' ||
        archetype === 'drinks' ||
        archetype === 'sweet' ||
        candidate.venue.category === 'restaurant' ||
        candidate.venue.category === 'cafe' ||
        candidate.venue.category === 'dessert' ||
        candidate.venue.category === 'bar');
}
function computeFallbackHighlightSuppression(stops, rolePools) {
    const finalHighlight = stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    if (!finalHighlight) {
        return {
            signal: 0,
            penalty: 0,
            applied: false,
            reason: 'no highlight selected',
        };
    }
    const pooledCandidates = getUniqueRolePoolCandidates(rolePools);
    const candidates = pooledCandidates.length > 0
        ? pooledCandidates
        : [
            ...new Map(stops.map((stop) => [getArcStopCandidateId(stop), stop.scoredVenue])).values(),
        ];
    const assessment = assessGenericHospitalityFallbackPenalty(finalHighlight, candidates);
    return {
        signal: finalHighlight.taste.fallbackPenalty.signalScore,
        penalty: clamp01(assessment.appliedPenalty * 0.92),
        applied: assessment.appliedPenalty > 0 && isGenericHospitalityFallbackCandidate(finalHighlight),
        reason: assessment.reason,
        strongerAlternativeName: assessment.strongerAlternativeName,
    };
}
function getHighlightExperienceFamily(candidate) {
    return candidate.taste.signals.experienceFamily;
}
function computeFamilyCompetitionLeadScore(candidate) {
    return (computePeakMomentLeadScore(candidate) +
        candidate.stopShapeFit.highlight * 0.12 +
        candidate.fitScore * 0.08 +
        candidate.taste.modeAlignment.score * 0.04);
}
function isFeasibleFamilyCompetitionHighlightCandidate(candidate, intent, lens) {
    if (hasPeakAnchorConflict(candidate, intent) ||
        !isPeakDistanceOk(candidate, intent) ||
        !isPeakHoursOk(candidate) ||
        hasPeakConstraintConflict(candidate)) {
        return false;
    }
    if (candidate.highlightValidity.validityLevel === 'invalid') {
        return false;
    }
    if (candidate.roleScores.peak < 0.58 || candidate.stopShapeFit.highlight < 0.34) {
        return false;
    }
    if (requiresRomanticPersonaMoment(lens) && !satisfiesRomanticPersonaHighlightContract(candidate, lens)) {
        return false;
    }
    return true;
}
function buildFamilyCompetitionField(stops, intent, lens, rolePools) {
    const finalHighlight = stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    const peakPool = rolePools?.peak ?? [];
    const threshold = requiresRomanticPersonaMoment(lens) ? 0.075 : 0.06;
    if (!finalHighlight || peakPool.length === 0) {
        return {
            finalHighlight,
            competitionCandidates: [],
            familyEntries: [],
            threshold,
            intensitySpread: 0,
            peakPoolSize: peakPool.length,
        };
    }
    const competitionCandidates = peakPool.filter((candidate) => isFeasibleFamilyCompetitionHighlightCandidate(candidate, intent, lens));
    const familyCounts = new Map();
    for (const candidate of competitionCandidates) {
        const family = getHighlightExperienceFamily(candidate);
        familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    }
    const familyLeaders = new Map();
    for (const candidate of competitionCandidates) {
        const family = getHighlightExperienceFamily(candidate);
        const current = familyLeaders.get(family);
        if (!current) {
            familyLeaders.set(family, candidate);
            continue;
        }
        const currentScore = computeFamilyCompetitionLeadScore(current);
        const nextScore = computeFamilyCompetitionLeadScore(candidate);
        if (nextScore > currentScore ||
            (nextScore === currentScore && candidate.fitScore > current.fitScore)) {
            familyLeaders.set(family, candidate);
        }
    }
    const familyEntries = [...familyLeaders.entries()]
        .map(([family, candidate]) => ({
        family,
        candidate,
        score: computeFamilyCompetitionLeadScore(candidate),
        poolCount: familyCounts.get(family) ?? 0,
    }))
        .sort((left, right) => right.score - left.score || left.family.localeCompare(right.family));
    const intensityValues = familyEntries
        .slice(0, Math.min(3, familyEntries.length))
        .map((entry) => entry.candidate.taste.signals.momentIntensity.score);
    const intensitySpread = intensityValues.length > 1
        ? Math.max(...intensityValues) - Math.min(...intensityValues)
        : 0;
    return {
        finalHighlight,
        competitionCandidates,
        familyEntries,
        threshold,
        intensitySpread,
        peakPoolSize: peakPool.length,
    };
}
function getEliteExperienceLane(candidate) {
    const family = candidate.taste.signals.experienceFamily;
    const activationType = candidate.taste.signals.hyperlocalActivation.primaryActivationType;
    const primaryArchetype = candidate.taste.signals.primaryExperienceArchetype;
    if (family === 'outdoor_scenic' ||
        primaryArchetype === 'scenic' ||
        primaryArchetype === 'outdoor') {
        return 'scenic_outdoor';
    }
    if (family === 'tasting_experience' ||
        family === 'intimate_dining' ||
        family === 'quiet_activity' ||
        activationType === 'tasting_activation' ||
        activationType === 'seasonal_market') {
        return 'experiential';
    }
    if (family === 'immersive_cultural' ||
        family === 'cultural' ||
        family === 'live_experience' ||
        family === 'immersive_experience' ||
        activationType === 'live_performance' ||
        activationType === 'cultural_activation') {
        return 'cultural_immersive';
    }
    if (family === 'ambient_indoor' ||
        family === 'atmospheric_experience' ||
        activationType === 'ambient_activation') {
        return 'atmospheric_ambient';
    }
    return 'other';
}
function buildDiversifiedEliteField(field, width, lens) {
    const bestEntry = field.familyEntries[0];
    if (!bestEntry) {
        return {
            entries: [],
            applied: false,
            reason: 'no elite field available',
            detectedLanes: [],
            laneCandidates: [],
        };
    }
    const romanticRichField = requiresRomanticPersonaMoment(lens) &&
        width.classification === 'moderate' &&
        field.peakPoolSize >= 4 &&
        field.familyEntries.length >= 3;
    const eliteScoreThreshold = Math.min(field.threshold, width.classification === 'broad' ? 0.05 : romanticRichField ? 0.06 : 0.04);
    const eliteIntensityThreshold = width.classification === 'broad' ? 0.06 : romanticRichField ? 0.06 : 0.05;
    const bestIntensity = bestEntry.candidate.taste.signals.momentIntensity.score;
    const bestScore = bestEntry.score;
    const nearBestCandidates = [...field.competitionCandidates]
        .filter((candidate) => {
        const score = computeFamilyCompetitionLeadScore(candidate);
        return (bestScore - score <= eliteScoreThreshold &&
            bestIntensity - candidate.taste.signals.momentIntensity.score <=
                eliteIntensityThreshold &&
            candidate.highlightValidity.validityLevel !== 'invalid' &&
            !candidate.taste.fallbackPenalty.applied &&
            candidate.taste.signals.momentIntensity.score >= 0.64 &&
            candidate.roleScores.peak >= 0.58 &&
            candidate.stopShapeFit.highlight >= 0.34);
    })
        .sort((left, right) => {
        return (computeFamilyCompetitionLeadScore(right) - computeFamilyCompetitionLeadScore(left) ||
            right.fitScore - left.fitScore);
    });
    const laneLeaderMap = new Map();
    for (const candidate of nearBestCandidates) {
        const lane = getEliteExperienceLane(candidate);
        if (!laneLeaderMap.has(lane)) {
            laneLeaderMap.set(lane, {
                lane,
                family: getHighlightExperienceFamily(candidate),
                candidate,
                score: computeFamilyCompetitionLeadScore(candidate),
            });
        }
    }
    const laneEntries = [...laneLeaderMap.values()].sort((left, right) => right.score - left.score || left.lane.localeCompare(right.lane));
    const detectedLanes = laneEntries.map((entry) => entry.lane);
    const laneCandidates = laneEntries.map((entry) => `${entry.lane} => ${getScoredVenueTraceLabel(entry.candidate)}`);
    if (laneEntries.length >= 2) {
        return {
            entries: laneEntries.slice(0, 3),
            applied: true,
            reason: `diversified elite field | ${laneEntries.length} lanes available`,
            detectedLanes,
            laneCandidates,
        };
    }
    const fallbackEntries = field.familyEntries
        .filter((entry) => bestEntry.score - entry.score <= eliteScoreThreshold &&
        bestIntensity - entry.candidate.taste.signals.momentIntensity.score <=
            eliteIntensityThreshold)
        .slice(0, 3)
        .map((entry) => ({
        lane: getEliteExperienceLane(entry.candidate),
        family: entry.family,
        candidate: entry.candidate,
        score: entry.score,
    }));
    return {
        entries: fallbackEntries,
        applied: false,
        reason: laneEntries.length === 1
            ? 'single valid lane near the leader'
            : 'lane diversification unavailable',
        detectedLanes,
        laneCandidates,
    };
}
function computeFamilyCompetitionPressure(stops, intent, lens, rolePools) {
    const field = buildFamilyCompetitionField(stops, intent, lens, rolePools);
    if (!field.finalHighlight || field.familyEntries.length === 0) {
        return {
            score: 0,
            penalty: 0,
            active: false,
            eligibleFamilies: [],
            topSpread: 0,
            threshold: field.threshold,
            winnerMode: 'single_family_only',
        };
    }
    if (field.familyEntries.length < 2) {
        return {
            score: 0,
            penalty: 0,
            active: false,
            eligibleFamilies: field.familyEntries.map((entry) => entry.family),
            leadingFamily: field.familyEntries[0]?.family,
            topSpread: 0,
            threshold: field.threshold,
            winnerMode: 'single_family_only',
        };
    }
    const bestEntry = field.familyEntries[0];
    const secondEntry = field.familyEntries[1];
    const topSpread = Math.max(0, bestEntry.score - secondEntry.score);
    const competingFamilies = field.familyEntries.filter((entry) => bestEntry.score - entry.score <= field.threshold);
    if (competingFamilies.length < 2) {
        return {
            score: 0,
            penalty: 0,
            active: false,
            eligibleFamilies: competingFamilies.map((entry) => entry.family),
            leadingFamily: bestEntry.family,
            topSpread,
            threshold: field.threshold,
            winnerMode: 'clear_family_lead',
        };
    }
    const finalFamily = getHighlightExperienceFamily(field.finalHighlight);
    const finalEntry = field.familyEntries.find((entry) => entry.family === finalFamily);
    const eligibleFamilies = competingFamilies.map((entry) => entry.family);
    const dominantPoolEntry = [...new Map(field.familyEntries.map((entry) => [entry.family, entry.poolCount])).entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
    const dominantPoolFamily = dominantPoolEntry?.[0];
    const dominantPoolShare = dominantPoolEntry && field.competitionCandidates.length > 0
        ? dominantPoolEntry[1] / field.competitionCandidates.length
        : 0;
    if (!finalEntry || !eligibleFamilies.includes(finalFamily)) {
        return {
            score: 0,
            penalty: 0.02,
            active: true,
            eligibleFamilies,
            leadingFamily: bestEntry.family,
            topSpread,
            threshold: field.threshold,
            winnerMode: 'competitive_field_non_competing_family_won',
        };
    }
    const gapToBest = Math.max(0, bestEntry.score - finalEntry.score);
    const competitiveness = clamp01(1 - gapToBest / field.threshold);
    const competitionBreadthBonus = Math.min(0.012, Math.max(0, competingFamilies.length - 1) * 0.004);
    const score = 0.018 +
        competitiveness * 0.024 +
        (finalFamily === bestEntry.family ? 0 : 0.012) +
        competitionBreadthBonus;
    const penalty = dominantPoolFamily === finalFamily &&
        dominantPoolShare >= 0.6 &&
        finalFamily === bestEntry.family
        ? 0.012 * clamp01(1 - topSpread / field.threshold)
        : 0;
    return {
        score,
        penalty,
        active: true,
        eligibleFamilies,
        leadingFamily: bestEntry.family,
        topSpread,
        threshold: field.threshold,
        winnerMode: finalFamily === bestEntry.family
            ? 'competitive_field_best_family_won'
            : 'competitive_field_alternate_family_won',
    };
}
function computeExpressionWidthFromField(field, lens, rolePools) {
    const finalHighlight = field.finalHighlight;
    const familyCount = field.familyEntries.length;
    const topSpread = field.familyEntries.length >= 2
        ? Math.max(0, field.familyEntries[0].score - field.familyEntries[1].score)
        : 0;
    const competitiveFamilyCount = field.familyEntries.length === 0
        ? 0
        : field.familyEntries.filter((entry) => field.familyEntries[0].score - entry.score <= field.threshold).length;
    const fallbackReliance = Boolean(finalHighlight &&
        (finalHighlight.highlightValidity.validityLevel === 'fallback' ||
            finalHighlight.taste.fallbackPenalty.applied));
    const contractCompressing = requiresRomanticPersonaMoment(lens) ||
        rolePools?.contractPoolStatus.peak.contractStrength === 'hard';
    let classification = 'narrow';
    if (familyCount >= 3 &&
        competitiveFamilyCount >= 3 &&
        field.peakPoolSize >= 5 &&
        !fallbackReliance) {
        classification = 'broad';
    }
    else if (familyCount >= 2 &&
        (competitiveFamilyCount >= 2 || (familyCount >= 3 && topSpread <= field.threshold * 1.2)) &&
        !fallbackReliance) {
        classification = 'moderate';
    }
    if (classification === 'moderate' &&
        contractCompressing &&
        familyCount <= 2 &&
        field.peakPoolSize <= 3) {
        classification = 'narrow';
    }
    const reasons = [
        `${familyCount} families`,
        `${competitiveFamilyCount} competitive`,
        `spread ${topSpread.toFixed(2)}/${field.threshold.toFixed(2)}`,
        `intensity ${field.intensitySpread.toFixed(2)}`,
        `peak pool ${field.peakPoolSize}`,
        contractCompressing ? 'contract compressing' : 'contract open',
        fallbackReliance ? 'fallback relied on' : 'no fallback reliance',
    ];
    return {
        classification,
        reason: reasons.join(' | '),
        familyCount,
        competitiveFamilyCount,
        intensitySpread: field.intensitySpread,
        peakPoolSize: field.peakPoolSize,
        fallbackReliance,
        topSpread,
    };
}
function computeExpressionWidth(stops, intent, lens, rolePools) {
    const field = buildFamilyCompetitionField(stops, intent, lens, rolePools);
    return computeExpressionWidthFromField(field, lens, rolePools);
}
function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function computeExpressionRelease(stops, intent, lens, rolePools) {
    const field = buildFamilyCompetitionField(stops, intent, lens, rolePools);
    const width = computeExpressionWidthFromField(field, lens, rolePools);
    const finalHighlight = field.finalHighlight;
    const bestEntry = field.familyEntries[0];
    const competingFamilies = field.familyEntries.filter((entry) => bestEntry && bestEntry.score - entry.score <= field.threshold);
    const romanticRichField = requiresRomanticPersonaMoment(lens) &&
        width.classification === 'moderate' &&
        field.peakPoolSize >= 4 &&
        field.familyEntries.length >= 3;
    if (!finalHighlight || !bestEntry) {
        return {
            score: 0,
            penalty: 0,
            eligible: false,
            reason: 'no highlight field available',
            eliteCandidateNames: [],
            eliteFamilies: [],
            eliteCandidateLanes: [],
            detectedLanes: [],
            laneCandidates: [],
            diversified: false,
            diversificationReason: 'no highlight field available',
            selectionMode: 'release_ineligible',
            decision: 'No release field available',
        };
    }
    if (width.classification === 'narrow') {
        return {
            score: 0,
            penalty: 0,
            eligible: false,
            reason: `width ${width.classification}`,
            eliteCandidateNames: [],
            eliteFamilies: [],
            eliteCandidateLanes: [],
            detectedLanes: [],
            laneCandidates: [],
            diversified: false,
            diversificationReason: `width ${width.classification}`,
            selectionMode: 'clear_winner',
            decision: 'Release held because the valid field is narrow',
        };
    }
    if (competingFamilies.length < 2) {
        return {
            score: 0,
            penalty: 0,
            eligible: false,
            reason: `family competition inactive | ${competingFamilies.length} near-equal families`,
            eliteCandidateNames: [],
            eliteFamilies: competingFamilies.map((entry) => entry.family),
            eliteCandidateLanes: [],
            detectedLanes: [],
            laneCandidates: [],
            diversified: false,
            diversificationReason: 'family competition inactive',
            selectionMode: 'clear_winner',
            decision: 'Release held because one family still leads clearly',
        };
    }
    const eliteField = buildDiversifiedEliteField(field, width, lens);
    const eliteEntries = eliteField.entries;
    if (eliteEntries.length < 2) {
        return {
            score: 0,
            penalty: 0,
            eligible: false,
            reason: `elite set too small | spread ${width.topSpread.toFixed(2)} | intensity ${width.intensitySpread.toFixed(2)}`,
            eliteCandidateNames: eliteEntries.map((entry) => entry.candidate.venue.name),
            eliteFamilies: eliteEntries.map((entry) => entry.family),
            eliteCandidateLanes: eliteEntries.map((entry) => entry.lane),
            detectedLanes: eliteField.detectedLanes,
            laneCandidates: eliteField.laneCandidates,
            diversified: eliteField.applied,
            diversificationReason: eliteField.reason,
            selectionMode: 'clear_winner',
            decision: 'Release held because only one elite candidate survived the tight gate',
        };
    }
    const selectionSeed = [
        intent.primaryAnchor,
        intent.persona ?? 'none',
        lens.resolvedContract?.blendMode ?? 'none',
        width.classification,
        ...eliteEntries.map((entry) => getScoredVenueCandidateId(entry.candidate)),
    ].join('|');
    const selectedIndex = stableHash(selectionSeed) % eliteEntries.length;
    const selectedEntry = eliteEntries[selectedIndex];
    const finalHighlightId = getScoredVenueCandidateId(finalHighlight);
    const finalIsSelected = finalHighlightId === getScoredVenueCandidateId(selectedEntry.candidate);
    const finalIsElite = eliteEntries.some((entry) => getScoredVenueCandidateId(entry.candidate) === finalHighlightId);
    const score = finalIsSelected ? (width.classification === 'broad' ? 0.03 : 0.026) : 0;
    const penalty = finalIsSelected ? 0 : finalIsElite ? 0.012 : 0.02;
    const releaseMode = selectedEntry.family === bestEntry.family
        ? 'competitive_field_lead_held'
        : 'competitive_field_alternate_selected';
    return {
        score,
        penalty,
        eligible: true,
        reason: `width ${width.classification} | ` +
            `${eliteEntries.length} elite candidates | ` +
            `${eliteField.applied ? 'lane diversified' : 'lane fallback'}` +
            (romanticRichField ? ' | rich romantic field' : ''),
        eliteCandidateNames: eliteEntries.map((entry) => entry.candidate.venue.name),
        eliteFamilies: eliteEntries.map((entry) => entry.family),
        eliteCandidateLanes: eliteEntries.map((entry) => entry.lane),
        detectedLanes: eliteField.detectedLanes,
        laneCandidates: eliteField.laneCandidates,
        diversified: eliteField.applied,
        diversificationReason: eliteField.reason,
        selectedCandidateName: selectedEntry.candidate.venue.name,
        selectedFamily: selectedEntry.family,
        selectionMode: releaseMode,
        decision: `${selectedEntry.candidate.venue.name} selected via stable bucket ${selectedIndex + 1}/${eliteEntries.length}`,
    };
}
function computeActivationMomentElevation(stops, intent, lens, rolePools) {
    const field = buildFamilyCompetitionField(stops, intent, lens, rolePools);
    const width = computeExpressionWidthFromField(field, lens, rolePools);
    const finalHighlight = field.finalHighlight;
    const bestEntry = field.familyEntries[0];
    const competingFamilies = field.familyEntries.filter((entry) => bestEntry && bestEntry.score - entry.score <= field.threshold);
    if (!finalHighlight || !bestEntry) {
        return {
            score: 0,
            penalty: 0,
            eligible: false,
            applied: false,
            reason: 'no highlight field available',
            candidateNames: [],
            candidateFamilies: [],
            winnerElevated: false,
        };
    }
    if (width.classification === 'narrow') {
        return {
            score: 0,
            penalty: 0,
            eligible: false,
            applied: false,
            reason: `width ${width.classification}`,
            candidateNames: [],
            candidateFamilies: [],
            winnerElevated: finalHighlight.taste.signals.isElevatedMomentCandidate,
        };
    }
    if (competingFamilies.length < 2) {
        return {
            score: 0,
            penalty: 0,
            eligible: false,
            applied: false,
            reason: `family competition inactive | ${competingFamilies.length} near-equal families`,
            candidateNames: [],
            candidateFamilies: [],
            winnerElevated: finalHighlight.taste.signals.isElevatedMomentCandidate,
        };
    }
    const eliteField = buildDiversifiedEliteField(field, width, lens);
    const bestCandidateScore = computeFamilyCompetitionLeadScore(bestEntry.candidate);
    const candidateScoreThreshold = width.classification === 'broad' ? 0.05 : requiresRomanticPersonaMoment(lens) ? 0.045 : 0.04;
    const candidateIntensityThreshold = width.classification === 'broad' ? 0.06 : 0.05;
    const bestCandidateIntensity = bestEntry.candidate.taste.signals.momentIntensity.score;
    const elevatedCandidates = eliteField.entries
        .map((entry) => entry.candidate)
        .filter((candidate) => {
        if (!candidate.taste.signals.isElevatedMomentCandidate) {
            return false;
        }
        if (bestCandidateScore - computeFamilyCompetitionLeadScore(candidate) >
            candidateScoreThreshold ||
            bestCandidateIntensity - candidate.taste.signals.momentIntensity.score >
                candidateIntensityThreshold) {
            return false;
        }
        if (candidate.highlightValidity.validityLevel === 'invalid') {
            return false;
        }
        if (candidate.taste.fallbackPenalty.applied) {
            return false;
        }
        return true;
    })
        .sort((left, right) => {
        return (right.taste.signals.momentElevationPotential -
            left.taste.signals.momentElevationPotential ||
            computeFamilyCompetitionLeadScore(right) - computeFamilyCompetitionLeadScore(left) ||
            right.fitScore - left.fitScore);
    })
        .slice(0, 3);
    const topElevatedCandidate = elevatedCandidates[0];
    if (!topElevatedCandidate) {
        return {
            score: 0,
            penalty: 0,
            eligible: false,
            applied: false,
            reason: 'no elevated candidates near the leader',
            candidateNames: [],
            candidateFamilies: [],
            winnerElevated: finalHighlight.taste.signals.isElevatedMomentCandidate,
        };
    }
    const finalHighlightId = getScoredVenueCandidateId(finalHighlight);
    const finalWinnerElevated = elevatedCandidates.some((candidate) => getScoredVenueCandidateId(candidate) === finalHighlightId);
    const topGapToLeader = Math.max(0, bestCandidateScore - computeFamilyCompetitionLeadScore(topElevatedCandidate));
    const topPotential = topElevatedCandidate.taste.signals.momentElevationPotential;
    const competitiveness = clamp01(1 - topGapToLeader / candidateScoreThreshold);
    const score = finalWinnerElevated
        ? 0.012 + competitiveness * 0.012 + topPotential * 0.008
        : 0;
    const penalty = !finalWinnerElevated && topGapToLeader <= candidateScoreThreshold
        ? 0.008 + competitiveness * 0.01
        : 0;
    const applied = score > 0 || penalty > 0;
    const candidateNames = elevatedCandidates.map((candidate) => getScoredVenueTraceLabel(candidate));
    const candidateFamilies = elevatedCandidates.map((candidate) => candidate.taste.signals.experienceFamily);
    return {
        score,
        penalty,
        eligible: true,
        applied,
        reason: finalWinnerElevated
            ? `competitive field | elevated moment held | gap ${topGapToLeader.toFixed(2)}/${candidateScoreThreshold.toFixed(2)}`
            : `competitive field | elevated candidate available but not selected | gap ${topGapToLeader.toFixed(2)}/${candidateScoreThreshold.toFixed(2)}`,
        candidateNames,
        candidateFamilies,
        topCandidateName: getScoredVenueTraceLabel(topElevatedCandidate),
        topCandidatePotential: topPotential,
        winnerElevated: finalWinnerElevated,
    };
}
function getCoarseArcCategory(stop) {
    const { venue } = stop.scoredVenue;
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
function getExperienceLane(stop) {
    const coarseCategory = getCoarseArcCategory(stop);
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
function isCasualVenue(stop) {
    const { venue } = stop.scoredVenue;
    const tagSet = new Set(venue.tags.map((tag) => tag.toLowerCase()));
    return (venue.energyLevel <= 3 ||
        venue.priceTier === '$' ||
        venue.priceTier === '$$' ||
        tagSet.has('casual') ||
        tagSet.has('relaxed'));
}
function computeRoleFlowScore(stops) {
    const roleScoreSum = stops.reduce((sum, stop) => sum + stop.scoredVenue.roleScores[stop.role], 0);
    return clamp01(roleScoreSum / stops.length);
}
function computeDiversityScore(stops, crewPolicy, lens) {
    const uniqueCategories = new Set(stops.map((stop) => stop.scoredVenue.venue.category));
    const diversity = uniqueCategories.size / stops.length;
    const repetitionPenalty = lens.repetitionTolerance === 'low' && diversity < 0.85 ? 0.12 : 0;
    return clamp01(diversity + crewPolicy.diversityBias * 0.2 - repetitionPenalty);
}
function computeCategoryDiversityGuardrail(stops, intent, lens) {
    const coreStops = stops.filter((stop) => stop.role === 'warmup' || stop.role === 'peak' || stop.role === 'cooldown');
    const nonAnchorCoreStops = coreStops.filter((stop) => !isUserLedAnchorStop(stop, intent));
    const groupedStops = new Map();
    for (const stop of coreStops) {
        const category = getCoarseArcCategory(stop);
        groupedStops.set(category, [...(groupedStops.get(category) ?? []), stop]);
    }
    const laneGroups = new Map();
    for (const stop of coreStops) {
        const lane = getExperienceLane(stop);
        laneGroups.set(lane, [...(laneGroups.get(lane) ?? []), stop]);
    }
    const archetypeGroups = new Map();
    for (const stop of coreStops) {
        const archetype = getPrimaryExperienceArchetype(stop);
        archetypeGroups.set(archetype, [...(archetypeGroups.get(archetype) ?? []), stop]);
    }
    const repeatedCategories = [...groupedStops.entries()].filter((entry) => entry[1].length > 1);
    const repeatedLanes = [...laneGroups.entries()].filter((entry) => entry[1].length > 1);
    const repeatedArchetypes = [...archetypeGroups.entries()].filter((entry) => entry[1].length > 1);
    const repeatedCategoryCount = repeatedCategories.reduce((sum, [, grouped]) => sum + (grouped.length - 1), 0);
    const repeatedLaneCount = repeatedLanes.reduce((sum, [, grouped]) => sum + (grouped.length - 1), 0);
    const repeatedArchetypeCount = repeatedArchetypes.reduce((sum, [, grouped]) => sum + (grouped.length - 1), 0);
    if (repeatedCategoryCount === 0 && repeatedLaneCount === 0 && repeatedArchetypeCount === 0) {
        const distinctNonAnchorCategories = new Set(nonAnchorCoreStops.map((stop) => getCoarseArcCategory(stop))).size;
        const distinctNonAnchorArchetypes = new Set(nonAnchorCoreStops.map((stop) => getPrimaryExperienceArchetype(stop))).size;
        const bonus = nonAnchorCoreStops.length >= 2 &&
            distinctNonAnchorCategories === nonAnchorCoreStops.length &&
            distinctNonAnchorArchetypes === nonAnchorCoreStops.length
            ? 0.06
            : nonAnchorCoreStops.length >= 2 &&
                distinctNonAnchorCategories >= 2 &&
                distinctNonAnchorArchetypes >= 2
                ? 0.03
                : 0;
        return {
            repeatedCategoryCount: 0,
            penalty: 0,
            bonus,
            notes: bonus > 0 ? ['core route keeps a distinct coarse-category mix across support roles'] : [],
        };
    }
    const maxRepeatCount = Math.max(...repeatedCategories.map((entry) => entry[1].length));
    const warmup = coreStops.find((stop) => stop.role === 'warmup');
    const peak = coreStops.find((stop) => stop.role === 'peak');
    const cooldown = coreStops.find((stop) => stop.role === 'cooldown');
    const warmupPeakRepeat = warmup && peak && getCoarseArcCategory(warmup) === getCoarseArcCategory(peak)
        ? 1
        : 0;
    const peakCooldownRepeat = peak && cooldown && getCoarseArcCategory(peak) === getCoarseArcCategory(cooldown)
        ? 1
        : 0;
    const penalty = repeatedCategories.reduce((sum, [, grouped]) => {
        const totalStops = grouped.length;
        const nonAnchorGroup = grouped.filter((stop) => !isUserLedAnchorStop(stop, intent));
        const nonAnchorStops = nonAnchorGroup.length;
        if (nonAnchorStops === 0) {
            return sum;
        }
        const bucketPenalty = totalStops >= 3
            ? 0.24
            : totalStops === 2
                ? 0.15
                : 0;
        const crossRolePenalty = Math.max(0, new Set(nonAnchorGroup.map((stop) => stop.role)).size - 1) * 0.03;
        return sum + bucketPenalty * (nonAnchorStops / totalStops) + crossRolePenalty;
    }, 0);
    const lanePenalty = repeatedLanes.reduce((sum, [lane, grouped]) => {
        const totalStops = grouped.length;
        const nonAnchorGroup = grouped.filter((stop) => !isUserLedAnchorStop(stop, intent));
        const nonAnchorStops = nonAnchorGroup.length;
        if (nonAnchorStops === 0) {
            return sum;
        }
        const repeatedLanePenalty = totalStops >= 3
            ? 0.1
            : totalStops === 2
                ? 0.05
                : 0;
        const crossRoleLanePenalty = Math.max(0, new Set(nonAnchorGroup.map((stop) => stop.role)).size - 1) * 0.02;
        const hospitalityLanePenalty = (lane === 'dining' || lane === 'drinks' || lane === 'sweet') && totalStops >= 2
            ? 0.02
            : 0;
        return (sum +
            repeatedLanePenalty * (nonAnchorStops / totalStops) +
            crossRoleLanePenalty +
            hospitalityLanePenalty * (nonAnchorStops / totalStops));
    }, 0);
    const archetypePenalty = repeatedArchetypes.reduce((sum, [archetype, grouped]) => {
        const totalStops = grouped.length;
        const nonAnchorGroup = grouped.filter((stop) => !isUserLedAnchorStop(stop, intent));
        const nonAnchorStops = nonAnchorGroup.length;
        if (nonAnchorStops === 0) {
            return sum;
        }
        const repeatPenalty = totalStops >= 3
            ? 0.12
            : totalStops === 2
                ? 0.055
                : 0;
        const lowMomentRepeats = nonAnchorGroup.filter((stop) => !isHighMomentPotential(stop.scoredVenue.taste.signals.momentPotential)).length;
        const lowMomentMultiplier = lowMomentRepeats === nonAnchorStops
            ? 1.18
            : lowMomentRepeats > 0
                ? 1.08
                : 0.94;
        const hospitalityPenalty = isHospitalityArchetype(archetype) && totalStops >= 2 ? 0.03 : 0;
        const tolerance = getArchetypeRepeatTolerance(archetype, lens.tasteMode?.id);
        return (sum +
            (repeatPenalty + hospitalityPenalty) *
                (nonAnchorStops / totalStops) *
                lowMomentMultiplier *
                tolerance);
    }, 0);
    const nonAnchorArchetypes = nonAnchorCoreStops.map((stop) => getPrimaryExperienceArchetype(stop));
    const hospitalityStopCount = nonAnchorArchetypes.filter((archetype) => isHospitalityArchetype(archetype)).length;
    const lowMomentHospitalityCount = nonAnchorCoreStops.filter((stop) => isHospitalityArchetype(getPrimaryExperienceArchetype(stop)) &&
        !isHighMomentPotential(stop.scoredVenue.taste.signals.momentPotential)).length;
    const distinctNonAnchorArchetypes = new Set(nonAnchorArchetypes).size;
    const lowVarianceHospitalityPenalty = hospitalityStopCount >= 2 &&
        distinctNonAnchorArchetypes <= 2 &&
        lowMomentHospitalityCount >= 2
        ? (lens.tasteMode?.id === 'cozy-flow' ? 0.05 : 0.08)
        : 0;
    const distinctNonAnchorCategories = new Set(nonAnchorCoreStops.map((stop) => getCoarseArcCategory(stop))).size;
    const bonus = nonAnchorCoreStops.length >= 2 &&
        distinctNonAnchorCategories === nonAnchorCoreStops.length &&
        distinctNonAnchorArchetypes === nonAnchorCoreStops.length
        ? 0.06
        : nonAnchorCoreStops.length >= 2 &&
            distinctNonAnchorCategories >= 2 &&
            distinctNonAnchorArchetypes >= 2
            ? 0.03
            : 0;
    const repeatedLabels = repeatedCategories.map(([category]) => category).join(', ');
    const notes = repeatedLabels.length > 0
        ? [`core route repeats coarse category ${repeatedLabels} across multiple roles`]
        : [];
    const repeatedLaneLabels = repeatedLanes.map(([lane]) => lane).join(', ');
    const repeatedArchetypeLabels = repeatedArchetypes
        .map(([archetype]) => archetype)
        .join(', ');
    if (warmupPeakRepeat) {
        notes.push('start and highlight land in the same coarse category');
    }
    if (peakCooldownRepeat) {
        notes.push('highlight and windDown land in the same coarse category');
    }
    if (maxRepeatCount >= 3) {
        notes.push('three or more core stops concentrate into one coarse category');
    }
    if (repeatedLaneLabels) {
        notes.push(`core route clusters into experience lane ${repeatedLaneLabels}`);
    }
    if (repeatedArchetypeLabels) {
        notes.push(`core route repeats experience archetype ${repeatedArchetypeLabels}`);
    }
    if (lowVarianceHospitalityPenalty > 0) {
        notes.push('core route leans too heavily on low-variance hospitality moments');
    }
    if (bonus > 0) {
        notes.push('distinct non-anchor category mix keeps the route varied');
    }
    return {
        repeatedCategoryCount,
        penalty: clamp01(penalty + lanePenalty + archetypePenalty + lowVarianceHospitalityPenalty),
        bonus,
        notes,
    };
}
function computeRoleAwareCategoryLift(stops, intent, lens) {
    const coreStops = stops.filter((stop) => (stop.role === 'warmup' || stop.role === 'peak' || stop.role === 'cooldown') &&
        !isUserLedAnchorStop(stop, intent));
    if (coreStops.length === 0) {
        return 0;
    }
    const totalLift = coreStops.reduce((sum, stop) => {
        const coarseCategory = getCoarseArcCategory(stop);
        const archetype = getPrimaryExperienceArchetype(stop);
        if (stop.role === 'warmup') {
            let lift = coarseCategory === 'coffee' ? 0.09 : 0;
            if (lens.tasteMode?.id === 'activity-led' &&
                (archetype === 'activity' || archetype === 'social' || archetype === 'outdoor')) {
                lift += 0.08;
            }
            if (lens.tasteMode?.id === 'scenic-outdoor' &&
                (archetype === 'outdoor' || archetype === 'scenic')) {
                lift += 0.08;
            }
            if (isCasualVenue(stop)) {
                lift += 0.05;
            }
            return sum + lift;
        }
        if (stop.role === 'peak') {
            if (lens.tasteMode?.id === 'activity-led' &&
                (archetype === 'activity' || archetype === 'social' || archetype === 'outdoor')) {
                return sum + 0.12;
            }
            if (lens.tasteMode?.id === 'scenic-outdoor' &&
                (archetype === 'outdoor' || archetype === 'scenic')) {
                return sum + 0.12;
            }
            if (coarseCategory === 'restaurant' || coarseCategory === 'entertainment') {
                return sum + 0.09;
            }
            if (coarseCategory === 'bar') {
                return sum + 0.07;
            }
            return sum;
        }
        if (coarseCategory === 'dessert') {
            return (sum +
                (lens.tasteMode?.id === 'scenic-outdoor' ? 0.11 : 0.09));
        }
        if (coarseCategory === 'bar') {
            return sum + 0.07;
        }
        if (coarseCategory === 'outdoor') {
            return sum + 0.06;
        }
        if (isCasualVenue(stop)) {
            return sum + 0.05;
        }
        return sum;
    }, 0);
    return clamp01(totalLift);
}
function computeAlignmentPreservationContract(stops, intent, lens, rolePools) {
    if (!lens.tasteMode) {
        return {
            alignmentPreservationScore: 0,
            penalty: 0,
            themeSpreadScore: 0,
            themeSpreadPenalty: 0,
            themeSpreadNote: 'highlight-only alignment',
            alignedStopCount: 0,
            strongAlignedStopCount: 0,
            availableAlignedCount: 0,
            availableStrongCount: 0,
        };
    }
    const nonProtectedStops = stops.filter((stop) => !isUserLedAnchorStop(stop, intent));
    const alignedStops = nonProtectedStops.filter((stop) => stop.scoredVenue.taste.modeAlignment.score >= 0.48);
    const strongAlignedStops = nonProtectedStops.filter((stop) => stop.scoredVenue.taste.modeAlignment.score >= 0.68 ||
        stop.scoredVenue.taste.modeAlignment.tier === 'primary');
    const rolePoolCandidates = rolePools
        ? [
            ...rolePools.warmup,
            ...rolePools.peak,
            ...rolePools.wildcard,
            ...rolePools.cooldown,
        ]
        : [];
    const uniqueCandidates = [
        ...new Map(rolePoolCandidates.map((item) => [getScoredVenueCandidateId(item), item])).values(),
    ];
    const availableAlignedCount = uniqueCandidates.filter((candidate) => candidate.taste.modeAlignment.score >= 0.48).length;
    const availableStrongCount = uniqueCandidates.filter((candidate) => candidate.taste.modeAlignment.score >= 0.68 ||
        candidate.taste.modeAlignment.tier === 'primary').length;
    const highlightAligned = nonProtectedStops.some((stop) => stop.role === 'peak' && stop.scoredVenue.taste.modeAlignment.score >= 0.48);
    const strongTasteModeActive = lens.tasteMode.enforcementStrength === 'strong' ||
        lens.tasteMode.alignmentWeight >= 0.4;
    const themeSpreadAvailable = availableAlignedCount >= 2;
    const themeReinforced = alignedStops.length >= 2;
    const enforcementWeight = lens.tasteMode.enforcementStrength === 'strong'
        ? 1
        : lens.tasteMode.enforcementStrength === 'moderate'
            ? 0.8
            : 0.55;
    const alignmentPreservationScore = clamp01((availableStrongCount > 0
        ? strongAlignedStops.length > 0
            ? 1
            : alignedStops.length > 0
                ? 0.52
                : 0
        : alignedStops.length > 0
            ? 0.72
            : 0) * enforcementWeight);
    const penalty = availableStrongCount > 0 && strongAlignedStops.length === 0
        ? alignedStops.length > 0
            ? 0.18 * enforcementWeight
            : 0.3 * enforcementWeight
        : availableAlignedCount > 0 && alignedStops.length === 0
            ? 0.2 * enforcementWeight
            : availableAlignedCount > alignedStops.length && alignedStops.length === 0
                ? 0.12 * enforcementWeight
                : 0;
    const themeSpreadScore = strongTasteModeActive && themeSpreadAvailable
        ? themeReinforced
            ? strongAlignedStops.length >= 2
                ? 1
                : 0.78
            : highlightAligned
                ? 0.28
                : alignedStops.length > 0
                    ? 0.18
                    : 0
        : 0;
    const themeSpreadPenalty = strongTasteModeActive &&
        themeSpreadAvailable &&
        highlightAligned &&
        alignedStops.length === 1
        ? 0.08 * enforcementWeight
        : 0;
    const themeSpreadNote = themeReinforced ? 'theme reinforced' : 'highlight-only alignment';
    return {
        alignmentPreservationScore,
        penalty,
        themeSpreadScore,
        themeSpreadPenalty,
        themeSpreadNote,
        alignedStopCount: alignedStops.length,
        strongAlignedStopCount: strongAlignedStops.length,
        availableAlignedCount,
        availableStrongCount,
    };
}
function computeMomentPreservationContract(stops, lens, rolePools) {
    const momentStops = stops.map((stop) => ({
        stop,
        identity: getMomentIdentity(stop),
    }));
    const presentHighMomentStops = momentStops.filter(({ stop }) => isHighMomentPotential(stop.scoredVenue.taste.signals.momentPotential));
    const strongMomentStops = momentStops.filter(({ identity }) => isStrongMomentIdentity(identity));
    const availableCandidates = rolePools
        ? [
            ...rolePools.warmup,
            ...rolePools.peak,
            ...rolePools.wildcard,
            ...rolePools.cooldown,
        ]
        : [];
    const availableHighMomentCount = [
        ...new Map(availableCandidates.map((candidate) => [getScoredVenueCandidateId(candidate), candidate])).values(),
    ].filter((candidate) => isHighMomentPotential(candidate.taste.signals.momentPotential)).length;
    const availableStrongMomentCount = [
        ...new Map(availableCandidates.map((candidate) => [getScoredVenueCandidateId(candidate), candidate])).values(),
    ].filter((candidate) => isStrongMomentIdentity(candidate.momentIdentity)).length;
    const highlightHighMoment = stops.some((stop) => stop.role === 'peak' &&
        isHighMomentPotential(stop.scoredVenue.taste.signals.momentPotential));
    const uniqueMomentTypes = new Set(momentStops.map(({ identity }) => identity.type)).size;
    const varianceScore = clamp01(uniqueMomentTypes >= 3
        ? 1
        : uniqueMomentTypes === 2
            ? 0.66
            : uniqueMomentTypes === 1 && momentStops.length > 0
                ? 0.24
                : 0);
    const warmup = momentStops.find(({ stop }) => stop.role === 'warmup')?.identity;
    const highlight = momentStops.find(({ stop }) => stop.role === 'peak')?.identity;
    const cooldown = momentStops.find(({ stop }) => stop.role === 'cooldown')?.identity;
    const roleSequenceScore = clamp01((warmup && (warmup.type === 'arrival' || warmup.type === 'explore') ? 0.34 : 0) +
        (highlight && (highlight.type === 'anchor' || highlight.type === 'explore') ? 0.4 : 0) +
        (cooldown && (cooldown.type === 'linger' || cooldown.type === 'close') ? 0.34 : 0));
    const highlightStrongMoment = highlight &&
        highlight.strength === 'strong' &&
        (highlight.type === 'anchor' || highlight.type === 'explore');
    const highlightIntensity = stops.find((stop) => stop.role === 'peak')?.scoredVenue.taste.signals.momentIntensity;
    const highIntensityHighlight = highlightIntensity?.tier === 'signature' || highlightIntensity?.tier === 'exceptional';
    const strongMomentPresent = strongMomentStops.length > 0;
    const allStopsSubStrong = momentStops.length > 0 && strongMomentStops.length === 0;
    const lowVarianceHospitalityArc = uniqueMomentTypes <= 2 &&
        stops.filter((stop) => isHospitalityArchetype(getPrimaryExperienceArchetype(stop))).length >= 2;
    const score = clamp01((strongMomentPresent
        ? highlightStrongMoment || highIntensityHighlight
            ? 0.72
            : 0.56
        : presentHighMomentStops.length > 0
            ? 0.22
            : 0) +
        Math.min(0.16, strongMomentStops.length * 0.06) +
        (highlightIntensity ? highlightIntensity.score * 0.12 : 0) +
        varianceScore * 0.18 +
        roleSequenceScore * 0.18 +
        (highlightHighMoment ? 0.08 : 0));
    const flatPenalty = (allStopsSubStrong ? 0.07 : 0) +
        (lowVarianceHospitalityArc ? 0.06 : uniqueMomentTypes <= 1 && momentStops.length > 0 ? 0.04 : 0);
    const missedStrongMomentPenalty = availableStrongMomentCount > 0 && !strongMomentPresent
        ? lens.tasteMode?.id === 'activity-led' || lens.tasteMode?.id === 'scenic-outdoor'
            ? 0.16
            : 0.1
        : 0;
    const penalty = clamp01(missedStrongMomentPenalty +
        (availableHighMomentCount > 0 && presentHighMomentStops.length === 0 ? 0.08 : 0) +
        flatPenalty);
    const qualityNote = (highlightStrongMoment || highIntensityHighlight) && varianceScore >= 0.66
        ? 'Clear main moment with distinct support beats.'
        : (strongMomentPresent || highIntensityHighlight) && roleSequenceScore >= 0.66
            ? 'Main moment is present and the arc resolves intentionally.'
            : strongMomentPresent || highIntensityHighlight
                ? 'A strong moment survived, but the rest of the arc is flatter.'
                : varianceScore >= 0.66
                    ? 'Moment beats vary, but no strong main moment survived.'
                    : 'Arc reads flat; most stops land on similar moment beats.';
    return {
        score,
        penalty,
        varianceScore,
        flatPenalty,
        strongMomentPresent,
        qualityNote,
        presentCount: presentHighMomentStops.length,
        availableCount: Math.max(availableHighMomentCount, availableStrongMomentCount),
    };
}
function computeHiddenGemLift(stops, intent, lens) {
    const baseline = stops.reduce((sum, stop) => sum + stop.scoredVenue.hiddenGemScore, 0) / stops.length;
    const wildcardLift = stops.some((stop) => stop.role === 'wildcard')
        ? lens.wildcardAggressiveness * 0.1
        : 0;
    const intentLift = intent.prefersHiddenGems ? 0.05 : 0;
    return clamp01(baseline + wildcardLift + intentLift);
}
function computeWindDownScore(stops, lens) {
    const cooldown = stops[stops.length - 1];
    const venue = cooldown?.scoredVenue.venue;
    if (!venue) {
        return 0;
    }
    const lowEnergyBonus = venue.energyLevel <= 2 ? 0.24 : venue.energyLevel <= 3 ? 0.12 : -0.24;
    const categoryBonus = lens.windDownExpectation.preferredCategories.includes(venue.category) ? 0.16 : 0;
    const categoryPenalty = lens.windDownExpectation.discouragedCategories.includes(venue.category) ? 0.22 : 0;
    const distancePenalty = lens.windDownExpectation.closeToBase && venue.driveMinutes > 16
        ? 0.1
        : venue.driveMinutes > 22
            ? 0.06
            : 0;
    const shapeFit = cooldown.scoredVenue.stopShapeFit.windDown;
    const momentIdentity = getMomentIdentity(cooldown);
    const momentBonus = momentIdentity.type === 'close'
        ? 0.18
        : momentIdentity.type === 'linger'
            ? 0.14
            : momentIdentity.type === 'transition'
                ? 0.05
                : -0.08;
    const momentStrengthBonus = momentIdentity.strength === 'medium'
        ? 0.06
        : momentIdentity.strength === 'light'
            ? 0.05
            : -0.03;
    return clamp01(cooldown.scoredVenue.roleScores.cooldown +
        lowEnergyBonus +
        categoryBonus +
        momentBonus +
        momentStrengthBonus +
        shapeFit * 0.18 -
        categoryPenalty -
        distancePenalty);
}
function computeVibeCoherence(stops) {
    const values = stops.map((stop) => {
        if (stop.role === 'warmup') {
            return stop.scoredVenue.vibeAuthority.byRole.start;
        }
        if (stop.role === 'peak') {
            return stop.scoredVenue.vibeAuthority.byRole.highlight;
        }
        if (stop.role === 'wildcard') {
            return stop.scoredVenue.vibeAuthority.byRole.surprise;
        }
        return stop.scoredVenue.vibeAuthority.byRole.windDown;
    });
    return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function computeHighlightVibeScore(stops) {
    const highlight = stops.find((stop) => stop.role === 'peak');
    if (!highlight) {
        return 0;
    }
    return clamp01(highlight.scoredVenue.vibeAuthority.byRole.highlight);
}
function toAmbianceBand(value) {
    if (value >= 0.66) {
        return 'high';
    }
    if (value <= 0.36) {
        return 'low';
    }
    return 'medium';
}
function deriveHighlightHospitalityMix(highlight) {
    const mix = {
        drinks: 0.16,
        dining: 0.2,
        culture: 0.14,
        cafe: 0.12,
        activity: 0.16,
    };
    const category = highlight.venue.category;
    const subcategory = highlight.venue.subcategory.toLowerCase();
    const tags = highlight.venue.tags.map((tag) => tag.toLowerCase());
    const archetype = highlight.taste.signals.primaryExperienceArchetype;
    if (category === 'restaurant') {
        mix.dining += 0.36;
    }
    else if (category === 'cafe') {
        mix.cafe += 0.34;
    }
    else if (category === 'bar') {
        mix.drinks += 0.34;
    }
    else if (category === 'live_music' || category === 'event') {
        mix.activity += 0.34;
    }
    else if (category === 'museum') {
        mix.culture += 0.34;
    }
    else if (category === 'dessert') {
        mix.dining += 0.16;
        mix.cafe += 0.16;
    }
    if (subcategory.includes('wine') || tags.some((tag) => tag.includes('wine'))) {
        mix.drinks += 0.12;
    }
    if (tags.some((tag) => ['cocktail', 'late-night', 'nightlife', 'social', 'speakeasy'].some((term) => tag.includes(term)))) {
        mix.drinks += 0.1;
        mix.activity += 0.08;
    }
    if (tags.some((tag) => ['museum', 'gallery', 'theater', 'arts', 'culture'].some((term) => tag.includes(term)))) {
        mix.culture += 0.14;
    }
    if (tags.some((tag) => ['coffee', 'tea', 'pastry', 'quiet'].some((term) => tag.includes(term)))) {
        mix.cafe += 0.12;
    }
    if (tags.some((tag) => ['game', 'arcade', 'activity', 'interactive'].some((term) => tag.includes(term)))) {
        mix.activity += 0.12;
    }
    if (tags.some((tag) => ['chef', 'tasting', 'dinner', 'prix'].some((term) => tag.includes(term)))) {
        mix.dining += 0.14;
    }
    if (archetype === 'dining' || archetype === 'sweet') {
        mix.dining += 0.14;
    }
    else if (archetype === 'drinks' || archetype === 'social') {
        mix.drinks += 0.14;
        mix.activity += 0.06;
    }
    else if (archetype === 'culture') {
        mix.culture += 0.16;
    }
    else if (archetype === 'activity') {
        mix.activity += 0.16;
    }
    else if (archetype === 'scenic' || archetype === 'outdoor') {
        mix.activity += 0.1;
        mix.culture += 0.08;
    }
    const total = mix.drinks + mix.dining + mix.culture + mix.cafe + mix.activity;
    if (total <= 0) {
        return mix;
    }
    return {
        drinks: clamp01(mix.drinks / total),
        dining: clamp01(mix.dining / total),
        culture: clamp01(mix.culture / total),
        cafe: clamp01(mix.cafe / total),
        activity: clamp01(mix.activity / total),
    };
}
function deriveHighlightFamilyFromStop(highlight, intent) {
    const signals = highlight.taste.signals;
    const family = detectExperienceFamily({
        dominantCategories: [
            highlight.venue.category,
            highlight.venue.subcategory,
            ...highlight.venue.tags.slice(0, 6),
        ],
        whyHereSignals: [
            ...signals.hyperlocalActivation.signals.slice(0, 4),
            ...signals.hyperlocalActivation.interpretationImpact.familyRefinements.slice(0, 2),
        ],
        activationStrength: clamp01(signals.experientialFactor * 0.42 +
            signals.socialDensity * 0.28 +
            signals.momentPotential.score * 0.3),
        environmentalInfluencePotential: clamp01(signals.destinationFactor * 0.44 +
            signals.lingerFactor * 0.24 +
            signals.experientialFactor * 0.32),
        momentPotential: signals.momentPotential.score,
        ambianceProfile: {
            energy: toAmbianceBand(signals.energy),
            intimacy: toAmbianceBand(signals.intimacy),
            noise: toAmbianceBand(signals.socialDensity),
        },
        hospitalityMix: deriveHighlightHospitalityMix(highlight),
        experientialTags: highlight.venue.tags,
    }, {
        persona: intent.persona ?? undefined,
        vibe: intent.primaryAnchor,
    });
    return family.family;
}
function areDirectionFamiliesCompatible(selectedFamily, highlightFamily) {
    if (selectedFamily === highlightFamily) {
        return true;
    }
    const compatibleFamilies = {
        social: ['eventful', 'playful'],
        cultural: ['ritual', 'exploratory', 'ambient'],
        playful: ['social', 'exploratory', 'eventful'],
        intimate: ['ambient', 'ritual', 'indulgent'],
        exploratory: ['playful', 'cultural', 'ambient'],
        ambient: ['intimate', 'ritual', 'exploratory', 'indulgent'],
        eventful: ['social', 'playful'],
        ritual: ['intimate', 'cultural', 'indulgent', 'ambient'],
        indulgent: ['intimate', 'ritual', 'ambient'],
    };
    return compatibleFamilies[selectedFamily]?.includes(highlightFamily) ?? false;
}
function computeHighlightIntegrityAdjustments(stops, intent) {
    const start = stops.find((stop) => stop.role === 'warmup');
    const highlight = stops.find((stop) => stop.role === 'peak');
    const windDown = stops.find((stop) => stop.role === 'cooldown');
    if (!highlight) {
        return {
            dominanceBoost: 0,
            weakPenalty: 0,
            familyAlignmentBoost: 0,
            familyMismatchPenalty: 0,
            supportPenalty: 0,
            highlightDominanceApplied: false,
            highlightFamilyAlignmentApplied: false,
            highlightSupportPenaltyApplied: false,
        };
    }
    const highlightIntensity = highlight.scoredVenue.taste.signals.momentIntensity.score;
    const dominanceBoost = highlightIntensity >= HIGHLIGHT_DOMINANCE_THRESHOLD ? HIGHLIGHT_DOMINANCE_BOOST : 0;
    const weakPenalty = highlightIntensity < HIGHLIGHT_DOMINANCE_THRESHOLD ? HIGHLIGHT_WEAK_PENALTY : 0;
    let familyAlignmentBoost = 0;
    let familyMismatchPenalty = 0;
    const selectedDirectionFamily = intent.selectedDirectionContext?.familyConfidence !== undefined &&
        intent.selectedDirectionContext.familyConfidence >= FAMILY_ALIGNMENT_CONFIDENCE_MIN
        ? intent.selectedDirectionContext.family
        : undefined;
    if (selectedDirectionFamily) {
        const highlightFamily = deriveHighlightFamilyFromStop(highlight.scoredVenue, intent);
        if (areDirectionFamiliesCompatible(selectedDirectionFamily, highlightFamily)) {
            familyAlignmentBoost = FAMILY_ALIGNMENT_BOOST;
        }
        else {
            familyMismatchPenalty = FAMILY_MISMATCH_PENALTY;
        }
    }
    let supportPenalty = 0;
    if (start && windDown) {
        const startIntensity = start.scoredVenue.taste.signals.momentIntensity.score;
        const windDownIntensity = windDown.scoredVenue.taste.signals.momentIntensity.score;
        const startTooSimilar = start.scoredVenue.venue.category === highlight.scoredVenue.venue.category &&
            Math.abs(startIntensity - highlightIntensity) <= 0.08 &&
            highlightIntensity <= startIntensity + 0.05;
        if (startTooSimilar) {
            supportPenalty += BAD_BUILD_PENALTY;
        }
        if (windDownIntensity > highlightIntensity) {
            supportPenalty += BAD_BUILD_PENALTY;
        }
    }
    return {
        dominanceBoost,
        weakPenalty,
        familyAlignmentBoost,
        familyMismatchPenalty,
        supportPenalty,
        highlightDominanceApplied: dominanceBoost > 0,
        highlightFamilyAlignmentApplied: familyAlignmentBoost > 0 || familyMismatchPenalty > 0,
        highlightSupportPenaltyApplied: supportPenalty > 0,
    };
}
function computeFakeCompletenessPenalty(stops) {
    const warmup = stops.find((stop) => stop.role === 'warmup');
    const highlight = stops.find((stop) => stop.role === 'peak');
    const cooldown = stops.find((stop) => stop.role === 'cooldown');
    if (!warmup || !highlight || !cooldown) {
        return {
            penalty: 0,
            applied: false,
        };
    }
    const highlightIntensity = highlight.scoredVenue.taste.signals.momentIntensity.score;
    const warmupIntensity = warmup.scoredVenue.taste.signals.momentIntensity.score;
    const cooldownIntensity = cooldown.scoredVenue.taste.signals.momentIntensity.score;
    const warmupWeakDuplicate = warmup.scoredVenue.venue.category === highlight.scoredVenue.venue.category &&
        warmup.scoredVenue.taste.signals.primaryExperienceArchetype ===
            highlight.scoredVenue.taste.signals.primaryExperienceArchetype &&
        Math.abs(warmupIntensity - highlightIntensity) <= 0.1 &&
        warmupIntensity <= 0.58;
    const cooldownWeakDuplicate = cooldown.scoredVenue.venue.category === highlight.scoredVenue.venue.category &&
        cooldown.scoredVenue.taste.signals.primaryExperienceArchetype ===
            highlight.scoredVenue.taste.signals.primaryExperienceArchetype &&
        Math.abs(cooldownIntensity - highlightIntensity) <= 0.1 &&
        cooldownIntensity <= 0.58;
    const weakEscalation = highlightIntensity - warmupIntensity < 0.06;
    const weakTaper = highlightIntensity - cooldownIntensity < 0.05;
    const applied = (warmupWeakDuplicate && weakEscalation) ||
        (cooldownWeakDuplicate && weakTaper) ||
        cooldownIntensity > highlightIntensity;
    return {
        penalty: applied ? FAKE_COMPLETENESS_PENALTY : 0,
        applied,
    };
}
function computeHighlightMomentScore(stops) {
    const highlight = stops.find((stop) => stop.role === 'peak');
    if (!highlight) {
        return 0;
    }
    const signals = highlight.scoredVenue.taste.signals;
    const momentIdentity = getMomentIdentity(highlight);
    const archetypeLift = signals.primaryExperienceArchetype === 'scenic' ||
        signals.primaryExperienceArchetype === 'outdoor' ||
        signals.primaryExperienceArchetype === 'activity' ||
        signals.primaryExperienceArchetype === 'culture'
        ? 0.16
        : signals.primaryExperienceArchetype === 'social'
            ? 0.08
            : 0.02;
    return clamp01(signals.momentPotential.score * 0.76 +
        signals.momentIntensity.score * 0.24 +
        getMomentIntensityTierBoost(signals.momentIntensity) * 0.9 +
        (isHighMomentPotential(signals.momentPotential) ? 0.14 : 0) +
        (momentIdentity.strength === 'strong' ? 0.1 : momentIdentity.strength === 'medium' ? 0.04 : 0) +
        (momentIdentity.type === 'anchor' || momentIdentity.type === 'explore' ? 0.08 : -0.04) +
        archetypeLift);
}
function computeHighlightValidityScore(stops) {
    const highlight = stops.find((stop) => stop.role === 'peak');
    if (!highlight) {
        return 0;
    }
    if (highlight.scoredVenue.highlightValidity.validityLevel === 'valid') {
        return 1;
    }
    if (highlight.scoredVenue.highlightValidity.validityLevel === 'fallback') {
        return 0.55;
    }
    return 0.12;
}
function computeArcContrastScore(stops) {
    const warmup = stops.find((stop) => stop.role === 'warmup');
    const highlight = stops.find((stop) => stop.role === 'peak');
    const cooldown = stops.find((stop) => stop.role === 'cooldown');
    if (!warmup || !highlight || !cooldown) {
        return 0;
    }
    const startPeakCategoryContrast = warmup.scoredVenue.venue.category === highlight.scoredVenue.venue.category ? 0.34 : 1;
    const peakCooldownCategoryContrast = highlight.scoredVenue.venue.category === cooldown.scoredVenue.venue.category ? 0.3 : 1;
    const startPeakArchetypeContrast = getPrimaryExperienceArchetype(warmup) === getPrimaryExperienceArchetype(highlight)
        ? 0.28
        : 1;
    const peakCooldownArchetypeContrast = getPrimaryExperienceArchetype(highlight) === getPrimaryExperienceArchetype(cooldown)
        ? 0.26
        : 1;
    const startPeakEnergyContrast = clamp01((highlight.scoredVenue.venue.energyLevel - warmup.scoredVenue.venue.energyLevel + 1) / 4);
    const peakCooldownEnergyContrast = clamp01((highlight.scoredVenue.venue.energyLevel - cooldown.scoredVenue.venue.energyLevel + 1) / 4);
    const startPeakAnchorSeparation = clamp01(0.5 +
        (highlight.scoredVenue.taste.signals.anchorStrength -
            warmup.scoredVenue.taste.signals.anchorStrength) *
            1.2);
    const peakCooldownAnchorSeparation = clamp01(0.5 +
        (highlight.scoredVenue.taste.signals.anchorStrength -
            cooldown.scoredVenue.taste.signals.anchorStrength) *
            1.1);
    const flattenedStartPenalty = warmup.scoredVenue.venue.category === highlight.scoredVenue.venue.category &&
        getPrimaryExperienceArchetype(warmup) === getPrimaryExperienceArchetype(highlight) &&
        Math.abs(warmup.scoredVenue.venue.energyLevel - highlight.scoredVenue.venue.energyLevel) <= 1
        ? 0.14
        : 0;
    const flattenedEndPenalty = highlight.scoredVenue.venue.category === cooldown.scoredVenue.venue.category &&
        getPrimaryExperienceArchetype(highlight) === getPrimaryExperienceArchetype(cooldown) &&
        Math.abs(highlight.scoredVenue.venue.energyLevel - cooldown.scoredVenue.venue.energyLevel) <= 1
        ? 0.16
        : 0;
    return clamp01(startPeakCategoryContrast * 0.12 +
        peakCooldownCategoryContrast * 0.12 +
        startPeakArchetypeContrast * 0.12 +
        peakCooldownArchetypeContrast * 0.12 +
        startPeakEnergyContrast * 0.16 +
        peakCooldownEnergyContrast * 0.18 +
        startPeakAnchorSeparation * 0.09 +
        peakCooldownAnchorSeparation * 0.09 +
        0.08 -
        flattenedStartPenalty -
        flattenedEndPenalty);
}
function computeHighlightCenteringScore(stops) {
    const warmup = stops.find((stop) => stop.role === 'warmup');
    const highlight = stops.find((stop) => stop.role === 'peak');
    const cooldown = stops.find((stop) => stop.role === 'cooldown');
    if (!warmup || !highlight || !cooldown) {
        return 0;
    }
    const supportAnchorAverage = (warmup.scoredVenue.taste.signals.anchorStrength +
        cooldown.scoredVenue.taste.signals.anchorStrength) /
        2;
    const supportRoleAverage = (warmup.scoredVenue.roleScores.warmup + cooldown.scoredVenue.roleScores.cooldown) / 2;
    const offPeakStrongMoment = stops.some((stop) => stop.role !== 'peak' && getMomentIdentity(stop).strength === 'strong');
    const highlightMomentPenalty = highlight.scoredVenue.momentIdentity.strength !== 'strong' && offPeakStrongMoment
        ? 0.22
        : highlight.scoredVenue.momentIdentity.type !== 'anchor' &&
            highlight.scoredVenue.momentIdentity.type !== 'explore'
            ? 0.1
            : 0;
    return clamp01(0.5 +
        (highlight.scoredVenue.taste.signals.anchorStrength - supportAnchorAverage) * 0.7 +
        (highlight.scoredVenue.roleScores.peak - supportRoleAverage) * 0.22 +
        highlight.scoredVenue.taste.signals.momentPotential.score * 0.12 +
        highlight.scoredVenue.taste.signals.categorySpecificity * 0.1 +
        highlight.scoredVenue.taste.signals.personalityStrength * 0.1 -
        highlightMomentPenalty);
}
function computeMissedPeakPenalty(stops, intent, rolePools) {
    const finalHighlight = stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    if (!finalHighlight || !rolePools) {
        return { penalty: 0, applied: false };
    }
    const availableCandidates = getUniqueRolePoolCandidates(rolePools);
    const strongestFeasiblePeakMoment = availableCandidates
        .filter((candidate) => isFeasiblePeakMomentLeadCandidate(candidate, intent))
        .sort((left, right) => {
        return (computePeakMomentLeadScore(right) - computePeakMomentLeadScore(left) ||
            right.roleScores.peak - left.roleScores.peak ||
            right.fitScore - left.fitScore);
    })[0];
    if (!strongestFeasiblePeakMoment) {
        return { penalty: 0, applied: false };
    }
    if (getScoredVenueCandidateId(strongestFeasiblePeakMoment) ===
        getScoredVenueCandidateId(finalHighlight)) {
        return { penalty: 0, applied: false };
    }
    const finalHighlightPassiveFallback = isHospitalityArchetype(finalHighlight.taste.signals.primaryExperienceArchetype) &&
        finalHighlight.momentIdentity.strength !== 'strong';
    const finalHighlightWeakMoment = (finalHighlight.momentIdentity.strength !== 'strong' &&
        finalHighlight.taste.signals.momentIntensity.tier === 'standard') ||
        (finalHighlight.momentIdentity.type !== 'anchor' &&
            finalHighlight.momentIdentity.type !== 'explore');
    const scoreDelta = Math.max(0, computePeakMomentLeadScore(strongestFeasiblePeakMoment) -
        computePeakMomentLeadScore(finalHighlight));
    return {
        penalty: clamp01(0.12 +
            Math.min(0.06, scoreDelta * 0.4) +
            (finalHighlightWeakMoment ? 0.03 : 0) +
            (finalHighlightPassiveFallback ? 0.03 : 0)),
        applied: true,
    };
}
function computeRomanticMomentContract(stops, intent, lens, rolePools) {
    const pooledCandidates = getUniqueRolePoolCandidates(rolePools);
    const uniqueCandidates = pooledCandidates.length > 0
        ? pooledCandidates
        : [
            ...new Map(stops.map((stop) => [getArcStopCandidateId(stop), stop.scoredVenue])).values(),
        ];
    const romanticCandidates = uniqueCandidates.filter((candidate) => assessRomanticPersonaHighlightQualification(candidate).qualifies);
    const feasibleRomanticCandidates = romanticCandidates.filter((candidate) => isFeasibleRomanticMomentCandidate(candidate, intent));
    const strongestRomanticCandidate = [...feasibleRomanticCandidates].sort((left, right) => {
        return (computeRomanticMomentLeadScore(right) - computeRomanticMomentLeadScore(left) ||
            right.roleScores.peak - left.roleScores.peak ||
            right.fitScore - left.fitScore);
    })[0] ??
        [...romanticCandidates].sort((left, right) => {
            return (computeRomanticMomentLeadScore(right) - computeRomanticMomentLeadScore(left) ||
                right.roleScores.peak - left.roleScores.peak ||
                right.fitScore - left.fitScore);
        })[0];
    const romanticStop = stops.find((stop) => {
        return (stop.role === 'peak' &&
            assessRomanticPersonaHighlightQualification(stop.scoredVenue).qualifies);
    }) ??
        stops.find((stop) => stop.role === 'warmup' &&
            assessRomanticPersonaHighlightQualification(stop.scoredVenue).qualifies) ??
        stops.find((stop) => stop.role === 'wildcard' &&
            assessRomanticPersonaHighlightQualification(stop.scoredVenue).qualifies) ??
        stops.find((stop) => stop.role === 'cooldown' &&
            assessRomanticPersonaHighlightQualification(stop.scoredVenue).qualifies);
    const present = Boolean(romanticStop);
    const romanticMomentRole = romanticStop?.role ?? 'none';
    const romanticPersonaActive = requiresRomanticPersonaMoment(lens);
    if (!romanticPersonaActive || feasibleRomanticCandidates.length === 0) {
        return {
            score: 0,
            penalty: 0,
            availableCount: romanticCandidates.length,
            feasibleCount: feasibleRomanticCandidates.length,
            present,
            romanticMomentRole,
            strongestCandidateName: strongestRomanticCandidate?.venue.name,
        };
    }
    return {
        score: present
            ? clamp01(0.08 +
                (romanticMomentRole === 'peak'
                    ? 0.07
                    : romanticMomentRole === 'wildcard'
                        ? 0.03
                        : romanticMomentRole === 'warmup'
                            ? 0.02
                            : 0) +
                (romanticStop &&
                    strongestRomanticCandidate &&
                    getScoredVenueCandidateId(romanticStop.scoredVenue) ===
                        getScoredVenueCandidateId(strongestRomanticCandidate)
                    ? 0.03
                    : 0))
            : 0,
        penalty: present
            ? 0
            : clamp01(0.1 +
                (strongestRomanticCandidate &&
                    strongestRomanticCandidate.roleScores.peak >= 0.6 &&
                    strongestRomanticCandidate.stopShapeFit.highlight >= 0.34
                    ? 0.03
                    : 0)),
        availableCount: romanticCandidates.length,
        feasibleCount: feasibleRomanticCandidates.length,
        present,
        romanticMomentRole,
        strongestCandidateName: strongestRomanticCandidate?.venue.name,
    };
}
function computeRomanticPersonaContract(stops, intent, lens, rolePools) {
    if (!requiresRomanticPersonaMoment(lens)) {
        return {
            score: 0,
            penalty: 0,
            satisfied: false,
            feasible: false,
            feasibleCount: 0,
            result: 'no_romantic_alternative_available',
        };
    }
    const pooledCandidates = getUniqueRolePoolCandidates(rolePools);
    const uniqueCandidates = pooledCandidates.length > 0
        ? pooledCandidates
        : [
            ...new Map(stops.map((stop) => [getArcStopCandidateId(stop), stop.scoredVenue])).values(),
        ];
    const feasibleRomanticHighlights = uniqueCandidates.filter((candidate) => isFeasibleRomanticHighlightCandidate(candidate, lens, intent));
    const finalHighlight = stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    const strongestFeasibleRomanticHighlight = [...feasibleRomanticHighlights].sort((left, right) => {
        return (right.taste.signals.momentIntensity.score - left.taste.signals.momentIntensity.score ||
            computeRomanticMomentLeadScore(right) - computeRomanticMomentLeadScore(left) ||
            right.roleScores.peak - left.roleScores.peak ||
            right.fitScore - left.fitScore);
    })[0];
    if (!finalHighlight || feasibleRomanticHighlights.length === 0) {
        return {
            score: 0,
            penalty: 0,
            satisfied: false,
            feasible: false,
            feasibleCount: feasibleRomanticHighlights.length,
            result: 'no_romantic_alternative_available',
        };
    }
    if (isFeasibleRomanticHighlightCandidate(finalHighlight, lens, intent)) {
        const highlightType = getRomanticPersonaHighlightType(finalHighlight);
        const bestAvailableGap = strongestFeasibleRomanticHighlight
            ? Math.max(0, strongestFeasibleRomanticHighlight.taste.signals.momentIntensity.score -
                finalHighlight.taste.signals.momentIntensity.score)
            : 0;
        const strongestAvailableTierGap = strongestFeasibleRomanticHighlight &&
            getScoredVenueCandidateId(strongestFeasibleRomanticHighlight) !==
                getScoredVenueCandidateId(finalHighlight)
            ? Math.max(0, getMomentIntensityRank(strongestFeasibleRomanticHighlight.taste.signals.momentIntensity.tier) -
                getMomentIntensityRank(finalHighlight.taste.signals.momentIntensity.tier))
            : 0;
        const strongestAvailableTierBoost = strongestFeasibleRomanticHighlight &&
            getScoredVenueCandidateId(strongestFeasibleRomanticHighlight) !==
                getScoredVenueCandidateId(finalHighlight)
            ? getMomentIntensityTierBoost(strongestFeasibleRomanticHighlight.taste.signals.momentIntensity)
            : 0;
        const strongestAvailableBonus = !strongestFeasibleRomanticHighlight ||
            getScoredVenueCandidateId(strongestFeasibleRomanticHighlight) ===
                getScoredVenueCandidateId(finalHighlight)
            ? clamp01(0.08 +
                finalHighlight.taste.signals.momentIntensity.score * 0.05 +
                getMomentIntensityTierBoost(finalHighlight.taste.signals.momentIntensity) * 0.3)
            : 0;
        const strongestAvailablePenalty = strongestFeasibleRomanticHighlight &&
            getScoredVenueCandidateId(strongestFeasibleRomanticHighlight) !==
                getScoredVenueCandidateId(finalHighlight)
            ? clamp01(0.14 +
                Math.min(0.08, bestAvailableGap * 2.4) +
                strongestAvailableTierBoost * 0.45 +
                strongestAvailableTierGap * 0.04)
            : 0;
        return {
            score: clamp01(0.16 +
                (highlightType === 'scenic' || highlightType === 'activity' ? 0.03 : 0) +
                finalHighlight.taste.signals.momentIntensity.score * 0.08 +
                getMomentIntensityTierBoost(finalHighlight.taste.signals.momentIntensity) * 0.35 +
                (finalHighlight.taste.signals.momentPotential.score >= 0.72 ? 0.02 : 0) +
                strongestAvailableBonus),
            penalty: strongestAvailablePenalty,
            satisfied: true,
            feasible: true,
            feasibleCount: feasibleRomanticHighlights.length,
            result: 'romantic_highlight_won',
        };
    }
    if (isGenericHospitalityHighlightCandidate(finalHighlight)) {
        return {
            score: 0,
            penalty: clamp01(0.26 +
                (lens.resolvedContract?.highlight.discourageGenericHighlight ? 0.08 : 0) +
                (finalHighlight.venue.category === 'bar' ? 0.04 : 0) +
                (finalHighlight.taste.signals.momentPotential.score < 0.68 ? 0.03 : 0) +
                (feasibleRomanticHighlights[0]
                    ? feasibleRomanticHighlights
                        .map((candidate) => candidate.taste.signals.momentIntensity.score)
                        .sort((left, right) => right - left)[0] * 0.06
                    : 0)),
            satisfied: false,
            feasible: true,
            feasibleCount: feasibleRomanticHighlights.length,
            result: 'generic_cozy_highlight_won',
        };
    }
    return {
        score: 0,
        penalty: 0.12,
        satisfied: false,
        feasible: true,
        feasibleCount: feasibleRomanticHighlights.length,
        result: 'non_generic_highlight_won',
    };
}
function computeMeaningfulMomentStretchScore(candidate) {
    return (computePeakMomentLeadScore(candidate) +
        candidate.taste.modeAlignment.score * 0.16 +
        candidate.roleContract.peak.score * 0.08);
}
function computeLocalStretchPolicy(stops, intent, rolePools) {
    if (intent.distanceMode !== 'nearby') {
        return {
            localSupplySufficient: true,
            strictNearbyFailed: false,
            stretchApplied: false,
            reason: 'not needed',
            candidateSetBasis: 'not applicable outside nearby mode',
            strictNearbyMeaningfulCount: 0,
            boundedStretchMeaningfulCount: 0,
            localSupplyDerivedFrom: 'nearby mode inactive',
            strictNearbyFailedDerivedFrom: 'nearby mode inactive',
            score: 0,
            penalty: 0,
        };
    }
    const pooledCandidates = getUniqueRolePoolCandidates(rolePools);
    const uniqueCandidates = pooledCandidates.length > 0
        ? pooledCandidates
        : [
            ...new Map(stops.map((stop) => [getArcStopCandidateId(stop), stop.scoredVenue])).values(),
        ];
    const feasibleMeaningfulCandidates = uniqueCandidates.filter((candidate) => isPeakHoursOk(candidate) &&
        !hasPeakConstraintConflict(candidate) &&
        !hasPeakAnchorConflict(candidate, intent) &&
        isCandidateWithinActiveDistanceWindow(candidate, intent, {
            allowMeaningfulStretch: true,
        }) &&
        candidate.roleScores.peak >= 0.64 &&
        candidate.stopShapeFit.highlight >= 0.4 &&
        (candidate.momentIdentity.strength === 'strong' ||
            isMeaningfulMomentStretchCandidate(candidate, intent)));
    const localMeaningfulCandidates = feasibleMeaningfulCandidates.filter((candidate) => isWithinStrictNearbyWindow(candidate.venue.driveMinutes, intent.distanceMode));
    const boundedMeaningfulCandidates = feasibleMeaningfulCandidates.filter((candidate) => isCandidateUsedByStretch(candidate, intent));
    const bestLocalMeaningful = [...localMeaningfulCandidates].sort((left, right) => {
        return (computeMeaningfulMomentStretchScore(right) - computeMeaningfulMomentStretchScore(left) ||
            right.fitScore - left.fitScore);
    })[0];
    const bestBoundedMeaningful = [...boundedMeaningfulCandidates].sort((left, right) => {
        return (computeMeaningfulMomentStretchScore(right) - computeMeaningfulMomentStretchScore(left) ||
            right.fitScore - left.fitScore);
    })[0];
    const localSupplySufficient = Boolean(bestLocalMeaningful);
    const strictNearbyFailed = !localSupplySufficient && Boolean(bestBoundedMeaningful);
    const stretchedStop = stops.find((stop) => isOutsideStrictNearbyButWithinBoundedStretch(stop.scoredVenue.venue.driveMinutes, intent.distanceMode) && isCandidateUsedByStretch(stop.scoredVenue, intent));
    const stretchApplied = strictNearbyFailed && Boolean(stretchedStop);
    return {
        localSupplySufficient,
        strictNearbyFailed,
        stretchApplied,
        reason: stretchApplied
            ? 'stronger bounded candidate used'
            : strictNearbyFailed
                ? 'no local strong moment'
                : 'not needed',
        candidateSetBasis: 'arc scorer unique role-pool candidates after peak feasibility gate',
        strictNearbyMeaningfulCount: localMeaningfulCandidates.length,
        boundedStretchMeaningfulCount: boundedMeaningfulCandidates.length,
        localSupplyDerivedFrom: localSupplySufficient
            ? `strict nearby meaningful count = ${localMeaningfulCandidates.length}`
            : 'strict nearby meaningful count = 0',
        strictNearbyFailedDerivedFrom: strictNearbyFailed
            ? `strict nearby meaningful count = 0, bounded stretch count = ${boundedMeaningfulCandidates.length}`
            : boundedMeaningfulCandidates.length > 0
                ? `strict nearby meaningful count = ${localMeaningfulCandidates.length}, bounded stretch count = ${boundedMeaningfulCandidates.length}`
                : 'bounded stretch count = 0',
        stretchedCandidateName: stretchedStop?.scoredVenue.venue.name,
        stretchedCandidateDistanceStatus: stretchedStop ? getStretchDistanceStatus(stretchedStop.scoredVenue, intent) : undefined,
        score: stretchApplied ? 0.06 : 0,
        penalty: strictNearbyFailed && bestBoundedMeaningful && !stretchApplied ? 0.04 : 0,
    };
}
function computeRoleEnergyBalance(stops) {
    const warmup = stops.find((stop) => stop.role === 'warmup');
    const highlight = stops.find((stop) => stop.role === 'peak');
    const cooldown = stops.find((stop) => stop.role === 'cooldown');
    if (!warmup || !highlight || !cooldown) {
        return { score: 0, penalty: 0, note: 'flat arc detected' };
    }
    const startMoment = getMomentIdentity(warmup);
    const highlightMoment = getMomentIdentity(highlight);
    const windDownMoment = getMomentIdentity(cooldown);
    const distinctEnds = getPrimaryExperienceArchetype(warmup) !== getPrimaryExperienceArchetype(cooldown);
    const startEntry = (startMoment.type === 'arrival' || startMoment.type === 'explore') &&
        startMoment.strength !== 'strong';
    const highlightPeak = highlightMoment.strength === 'strong' &&
        (highlightMoment.type === 'anchor' || highlightMoment.type === 'explore');
    const windDownResolution = windDownMoment.type === 'close' ||
        (windDownMoment.type === 'linger' && windDownMoment.strength !== 'strong');
    const energyRampPreserved = highlightPeak &&
        startMoment.strength !== 'strong' &&
        windDownMoment.strength !== 'strong';
    const softStartFallback = (startMoment.type === 'close' || startMoment.type === 'linger') &&
        startMoment.strength !== 'strong';
    const flatLightArc = startMoment.strength !== 'strong' &&
        highlightMoment.strength !== 'strong' &&
        windDownMoment.strength !== 'strong';
    const invertedStrongArc = startMoment.strength === 'strong' &&
        highlightMoment.strength === 'strong' &&
        windDownMoment.strength === 'strong';
    return {
        score: clamp01((distinctEnds ? 0.08 : 0) +
            (energyRampPreserved ? 0.12 : 0) +
            (startEntry ? 0.05 : 0) +
            (windDownResolution ? 0.05 : 0)),
        penalty: clamp01((flatLightArc ? 0.05 : 0) +
            (invertedStrongArc ? 0.07 : 0) +
            (softStartFallback ? 0.035 : 0) +
            (!windDownResolution ? 0.025 : 0) +
            (!windDownResolution && windDownMoment.strength === 'strong' ? 0.03 : 0)),
        note: energyRampPreserved
            ? 'ramp-up preserved'
            : softStartFallback
                ? 'soft start fallback'
                : 'flat arc detected',
    };
}
function computeLensCoherence(stops) {
    const values = stops.map((stop) => {
        if (stop.role === 'warmup') {
            return stop.scoredVenue.stopShapeFit.start;
        }
        if (stop.role === 'peak') {
            return stop.scoredVenue.stopShapeFit.highlight;
        }
        if (stop.role === 'wildcard') {
            return stop.scoredVenue.stopShapeFit.surprise;
        }
        return stop.scoredVenue.stopShapeFit.windDown;
    });
    return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function computeContextSpecificityLift(stops) {
    const values = stops.map((stop) => stop.scoredVenue.contextSpecificity.byRole[stop.role]);
    return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function computeDominancePenalty(stops) {
    const values = stops.map((stop) => {
        const base = stop.scoredVenue.dominanceControl.byRole[stop.role];
        return stop.role === 'peak' ? base * 1.35 : stop.role === 'wildcard' ? base * 1.15 : base;
    });
    return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function getPreferredDiscoveryVenueIdForRole(intent, role) {
    return intent.discoveryPreferences?.find((preference) => {
        if (role === 'warmup') {
            return preference.role === 'start';
        }
        if (role === 'peak') {
            return preference.role === 'highlight';
        }
        if (role === 'cooldown') {
            return preference.role === 'windDown';
        }
        return false;
    })?.venueId;
}
function isUserLedAnchorStop(stop, intent) {
    if (intent.planningMode !== 'user-led' || !intent.anchor?.venueId) {
        return false;
    }
    const anchorRole = intent.anchor.role ?? 'highlight';
    return (getArcStopBaseVenueId(stop) === intent.anchor.venueId &&
        ((anchorRole === 'start' && stop.role === 'warmup') ||
            (anchorRole === 'highlight' && stop.role === 'peak') ||
            (anchorRole === 'windDown' && stop.role === 'cooldown')));
}
function getEffectiveContractEvaluation(stop, intent, rolePools) {
    const evaluation = stop.scoredVenue.roleContract[stop.role];
    if (isUserLedAnchorStop(stop, intent)) {
        return {
            score: 1,
            satisfied: true,
            strength: evaluation.strength,
            overrideApplied: true,
        };
    }
    if (!rolePools || stop.role === 'wildcard') {
        return {
            score: evaluation.score,
            satisfied: evaluation.satisfied,
            strength: evaluation.strength,
            overrideApplied: false,
        };
    }
    const preferredVenueId = getPreferredDiscoveryVenueIdForRole(intent, stop.role);
    const contractStatus = rolePools.contractPoolStatus[stop.role];
    const overrideApplied = contractStatus.preferredDiscoveryVenueAdmitted === true &&
        contractStatus.preferredDiscoveryVenueRejectedReason === undefined &&
        contractStatus.preferredDiscoveryVenueId === getArcStopBaseVenueId(stop) &&
        preferredVenueId === getArcStopBaseVenueId(stop);
    if (!overrideApplied) {
        return {
            score: evaluation.score,
            satisfied: evaluation.satisfied,
            strength: evaluation.strength,
            overrideApplied: false,
        };
    }
    return {
        score: 1,
        satisfied: true,
        strength: evaluation.strength,
        overrideApplied: true,
    };
}
function resolveEffectiveContractEvaluations(stops, intent, rolePools) {
    return stops.map((stop) => ({
        stop,
        evaluation: getEffectiveContractEvaluation(stop, intent, rolePools),
    }));
}
function computeContractCompliance(effectiveEvaluations) {
    const values = effectiveEvaluations.map(({ stop, evaluation }) => {
        const roleWeight = stop.role === 'peak' ? 1.25 : stop.role === 'cooldown' ? 1.1 : 1;
        return evaluation.score * roleWeight;
    });
    const totalWeight = effectiveEvaluations.reduce((sum, { stop }) => {
        if (stop.role === 'peak') {
            return sum + 1.25;
        }
        if (stop.role === 'cooldown') {
            return sum + 1.1;
        }
        return sum + 1;
    }, 0);
    if (totalWeight === 0) {
        return 0;
    }
    return clamp01(values.reduce((sum, value) => sum + value, 0) / totalWeight);
}
function computeContractViolationPenalty(effectiveEvaluations) {
    const penalties = effectiveEvaluations.map(({ stop, evaluation }) => {
        if (evaluation.satisfied || evaluation.strength === 'none') {
            return 0;
        }
        const strengthWeight = evaluation.strength === 'soft' ? 0.08 : evaluation.strength === 'strong' ? 0.16 : 0.24;
        return (1 - evaluation.score) * strengthWeight * (stop.role === 'peak' ? 1.2 : 1);
    });
    return clamp01(penalties.reduce((sum, value) => sum + value, 0) / effectiveEvaluations.length);
}
function computeLiveRolePromotionScore(stops) {
    const promotionTotal = stops.reduce((sum, stop) => sum + computeRoleAwareLiveLift(stop.scoredVenue, stop.role).promotion, 0);
    return clamp01(promotionTotal / 0.1);
}
function toInternalRole(preferenceRole) {
    if (preferenceRole === 'start') {
        return 'warmup';
    }
    if (preferenceRole === 'highlight') {
        return 'peak';
    }
    return 'cooldown';
}
function computeDiscoveryContract(stops, intent, rolePools) {
    const preferences = intent.discoveryPreferences;
    if (!preferences || preferences.length === 0) {
        return { score: 0, penalty: 0 };
    }
    let weightedMatches = 0;
    let weightedPenalty = 0;
    let totalWeight = 0;
    for (const preference of preferences) {
        const role = toInternalRole(preference.role);
        const weight = preference.role === 'highlight' ? 1.8 : 1.2;
        const acceptedForRole = rolePools
            ? getRolePoolForRole(role, rolePools).some((candidate) => getScoredVenueBaseVenueId(candidate) === preference.venueId)
            : true;
        const exactRoleMatch = stops.some((stop) => stop.role === role && getArcStopBaseVenueId(stop) === preference.venueId);
        const wrongRoleMatch = stops.some((stop) => stop.role !== role && getArcStopBaseVenueId(stop) === preference.venueId);
        totalWeight += weight;
        if (!acceptedForRole) {
            weightedMatches += weight * 0.55;
            continue;
        }
        if (exactRoleMatch) {
            weightedMatches += weight;
            continue;
        }
        if (wrongRoleMatch) {
            weightedMatches += weight * 0.08;
            weightedPenalty += weight * (preference.role === 'highlight' ? 0.42 : 0.28);
            continue;
        }
        weightedPenalty += weight * (preference.role === 'highlight' ? 0.54 : 0.34);
    }
    if (totalWeight === 0) {
        return { score: 0, penalty: 0 };
    }
    return {
        score: clamp01(weightedMatches / totalWeight),
        penalty: clamp01(weightedPenalty / totalWeight),
    };
}
export function scoreArcAssembly(stops, intent, crewPolicy, lens, rolePools) {
    const pacing = computeRouteDuration(stops, intent);
    const spatial = computeSpatialCoherence(stops, intent);
    const categoryDiversityGuardrail = computeCategoryDiversityGuardrail(stops, intent, lens);
    const breakdown = {
        roleFlowScore: computeRoleFlowScore(stops),
        diversityScore: computeDiversityScore(stops, crewPolicy, lens),
        repeatedCategoryCount: categoryDiversityGuardrail.repeatedCategoryCount,
        categoryDiversityPenalty: categoryDiversityGuardrail.penalty,
        categoryDiversityNotes: categoryDiversityGuardrail.notes,
        geographyScore: spatial.score,
        spatialCoherenceScore: spatial.score,
        spatialBonus: spatial.spatialBonus,
        spatialPenalty: spatial.spatialPenalty,
        hiddenGemLift: computeHiddenGemLift(stops, intent, lens),
        windDownScore: computeWindDownScore(stops, lens),
        durationPacingScore: pacing.pacingScore,
        transitionSmoothnessScore: pacing.transitionSmoothnessScore,
        outingLengthScore: pacing.outingLengthScore,
        awkwardPacingPenalty: pacing.awkwardPacingPenalty,
    };
    const finalHighlight = stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    const recoveredCentralMomentHighlight = Boolean(finalHighlight?.recoveredCentralMomentHighlight);
    const lensCoherence = computeLensCoherence(stops);
    const contextSpecificityLift = computeContextSpecificityLift(stops);
    const dominancePenalty = computeDominancePenalty(stops);
    const effectiveContractEvaluations = resolveEffectiveContractEvaluations(stops, intent, rolePools);
    const contractCompliance = computeContractCompliance(effectiveContractEvaluations);
    const contractViolationPenalty = computeContractViolationPenalty(effectiveContractEvaluations);
    const contractOverrideRoles = effectiveContractEvaluations
        .filter(({ evaluation }) => evaluation.overrideApplied)
        .map(({ stop }) => stop.role);
    const vibeCoherence = computeVibeCoherence(stops);
    const highlightVibeScore = computeHighlightVibeScore(stops);
    const highlightValidityScore = computeHighlightValidityScore(stops);
    const highlightMomentScore = computeHighlightMomentScore(stops);
    const arcContrastScore = computeArcContrastScore(stops);
    const highlightCenteringScore = computeHighlightCenteringScore(stops);
    const discoveryContract = computeDiscoveryContract(stops, intent, rolePools);
    const supportStopVibeFit = computeSupportStopVibeFit(stops, intent);
    const routeShapeBias = computeRouteShapeBias(stops, intent, lens);
    const alignmentPreservation = computeAlignmentPreservationContract(stops, intent, lens, rolePools);
    const momentPreservation = computeMomentPreservationContract(stops, lens, rolePools);
    const missedPeakPenalty = computeMissedPeakPenalty(stops, intent, rolePools);
    const romanticMomentContract = computeRomanticMomentContract(stops, intent, lens, rolePools);
    const romanticPersonaContract = computeRomanticPersonaContract(stops, intent, lens, rolePools);
    const fallbackHighlightSuppression = computeFallbackHighlightSuppression(stops, rolePools);
    const familyCompetition = computeFamilyCompetitionPressure(stops, intent, lens, rolePools);
    const expressionWidth = computeExpressionWidth(stops, intent, lens, rolePools);
    const expressionRelease = computeExpressionRelease(stops, intent, lens, rolePools);
    const activationMomentElevation = computeActivationMomentElevation(stops, intent, lens, rolePools);
    const localStretchPolicy = computeLocalStretchPolicy(stops, intent, rolePools);
    const roleEnergyBalance = computeRoleEnergyBalance(stops);
    const highlightIntegrity = computeHighlightIntegrityAdjustments(stops, intent);
    const fakeCompleteness = computeFakeCompletenessPenalty(stops);
    const liveRolePromotionScore = computeLiveRolePromotionScore(stops);
    const roleAwareCategoryLift = computeRoleAwareCategoryLift(stops, intent, lens);
    const totalScoreRaw = breakdown.roleFlowScore * 0.34 +
        breakdown.diversityScore * 0.12 +
        breakdown.geographyScore * 0.2 +
        breakdown.hiddenGemLift * 0.1 +
        breakdown.windDownScore * 0.14 +
        pacing.pacingScore * 0.12 +
        pacing.transitionSmoothnessScore * 0.1 +
        pacing.outingLengthScore * 0.08 +
        vibeCoherence * 0.1 +
        highlightVibeScore * 0.12 +
        highlightMomentScore * 0.18 +
        momentPreservation.varianceScore * 0.12 +
        highlightValidityScore * 0.16 +
        arcContrastScore * 0.16 +
        highlightCenteringScore * 0.14 +
        discoveryContract.score * 0.4 +
        supportStopVibeFit.overall * 0.14 +
        routeShapeBias.score * 0.08 +
        alignmentPreservation.alignmentPreservationScore * 0.32 +
        alignmentPreservation.themeSpreadScore * 0.08 +
        momentPreservation.score * 0.16 +
        romanticPersonaContract.score +
        familyCompetition.score +
        expressionRelease.score +
        activationMomentElevation.score +
        localStretchPolicy.score +
        roleEnergyBalance.score * 0.1 +
        liveRolePromotionScore * 0.06 +
        roleAwareCategoryLift * 0.12 +
        highlightIntegrity.dominanceBoost +
        highlightIntegrity.familyAlignmentBoost +
        categoryDiversityGuardrail.bonus +
        lensCoherence * 0.1 +
        contextSpecificityLift * 0.09 -
        highlightIntegrity.weakPenalty -
        highlightIntegrity.familyMismatchPenalty -
        highlightIntegrity.supportPenalty -
        fakeCompleteness.penalty -
        discoveryContract.penalty * 0.18 -
        categoryDiversityGuardrail.penalty -
        pacing.awkwardPacingPenalty * 0.14 -
        dominancePenalty * 0.08 +
        contractCompliance * 0.12 -
        contractViolationPenalty * 0.16 -
        momentPreservation.flatPenalty -
        momentPreservation.penalty -
        romanticPersonaContract.penalty -
        familyCompetition.penalty -
        expressionRelease.penalty -
        activationMomentElevation.penalty -
        fallbackHighlightSuppression.penalty -
        localStretchPolicy.penalty -
        alignmentPreservation.themeSpreadPenalty -
        roleEnergyBalance.penalty -
        missedPeakPenalty.penalty -
        alignmentPreservation.penalty;
    const totalScore = normalizeArcTotalScore(totalScoreRaw);
    return {
        totalScore,
        pacing,
        spatial,
        scoreBreakdown: {
            ...breakdown,
            vibeCoherenceScore: clamp01(vibeCoherence),
            highlightVibeScore: clamp01(highlightVibeScore),
            highlightMomentScore: clamp01(highlightMomentScore),
            momentStrengthScore: clamp01(momentPreservation.score),
            momentVarianceScore: clamp01(momentPreservation.varianceScore),
            momentFlatPenalty: clamp01(momentPreservation.flatPenalty + momentPreservation.penalty),
            romanticMomentCandidatesAvailable: romanticMomentContract.availableCount,
            romanticMomentCandidatesFeasible: romanticMomentContract.feasibleCount,
            romanticMomentPresent: romanticMomentContract.present,
            romanticMomentRole: romanticMomentContract.romanticMomentRole,
            strongestRomanticCandidateName: romanticMomentContract.strongestCandidateName,
            romanticContractScore: clamp01(romanticPersonaContract.score),
            romanticContractPenalty: clamp01(romanticPersonaContract.penalty),
            romanticContractSatisfied: romanticPersonaContract.satisfied,
            romanticContractFeasible: romanticPersonaContract.feasible,
            romanticHighlightCandidatesFeasible: romanticPersonaContract.feasibleCount,
            romanticHighlightArbitrationScore: clamp01(romanticPersonaContract.score),
            romanticHighlightArbitrationPenalty: clamp01(romanticPersonaContract.penalty),
            romanticHighlightArbitrationResult: romanticPersonaContract.result,
            localSupplySufficient: localStretchPolicy.localSupplySufficient,
            strictNearbyFailed: localStretchPolicy.strictNearbyFailed,
            stretchApplied: localStretchPolicy.stretchApplied,
            stretchReason: localStretchPolicy.reason,
            localStretchCandidateSetBasis: localStretchPolicy.candidateSetBasis,
            strictNearbyMeaningfulCount: localStretchPolicy.strictNearbyMeaningfulCount,
            boundedStretchMeaningfulCount: localStretchPolicy.boundedStretchMeaningfulCount,
            localSupplyDerivedFrom: localStretchPolicy.localSupplyDerivedFrom,
            strictNearbyFailedDerivedFrom: localStretchPolicy.strictNearbyFailedDerivedFrom,
            stretchedCandidateName: localStretchPolicy.stretchedCandidateName,
            stretchedCandidateDistanceStatus: localStretchPolicy.stretchedCandidateDistanceStatus,
            missedPeakPenalty: clamp01(missedPeakPenalty.penalty),
            missedPeakApplied: missedPeakPenalty.applied,
            roleEnergyScore: clamp01(roleEnergyBalance.score),
            roleEnergyPenalty: clamp01(roleEnergyBalance.penalty),
            roleEnergyNote: roleEnergyBalance.note,
            strongMomentPresent: momentPreservation.strongMomentPresent,
            momentQualityNote: momentPreservation.qualityNote,
            highlightValidityScore: clamp01(highlightValidityScore),
            arcContrastScore: clamp01(arcContrastScore),
            highlightCenteringScore: clamp01(highlightCenteringScore),
            discoveryContractScore: clamp01(discoveryContract.score),
            supportStopVibeScore: clamp01(supportStopVibeFit.overall),
            routeShapeBiasScore: clamp01(routeShapeBias.score),
            alignmentPreservationScore: clamp01(alignmentPreservation.alignmentPreservationScore),
            themeSpreadScore: clamp01(alignmentPreservation.themeSpreadScore),
            themeSpreadPenalty: clamp01(alignmentPreservation.themeSpreadPenalty),
            themeSpreadNote: alignmentPreservation.themeSpreadNote,
            tasteModeAlignmentScore: clamp01(alignmentPreservation.alignmentPreservationScore),
            tasteModePresencePenalty: clamp01(alignmentPreservation.penalty),
            tasteModeAlignedStopCount: alignmentPreservation.alignedStopCount,
            tasteModeStrongAlignedStopCount: alignmentPreservation.strongAlignedStopCount,
            tasteModeAvailableAlignedCount: alignmentPreservation.availableAlignedCount,
            tasteModeAvailableStrongCount: alignmentPreservation.availableStrongCount,
            liveRolePromotionScore: clamp01(liveRolePromotionScore),
            contractComplianceScore: clamp01(contractCompliance),
            contractViolationPenalty: clamp01(contractViolationPenalty),
            contractOverrideApplied: contractOverrideRoles.length > 0,
            contractOverrideRoles,
            fallbackHighlightSignal: clamp01(fallbackHighlightSuppression.signal),
            fallbackHighlightPenalty: clamp01(fallbackHighlightSuppression.penalty),
            fallbackHighlightPenaltyApplied: fallbackHighlightSuppression.applied,
            fallbackHighlightReason: fallbackHighlightSuppression.reason,
            fallbackHighlightAlternativeName: fallbackHighlightSuppression.strongerAlternativeName,
            familyCompetitionScore: clamp01(familyCompetition.score),
            familyCompetitionPenalty: clamp01(familyCompetition.penalty),
            familyCompetitionActive: familyCompetition.active,
            familyCompetitionEligibleFamilies: familyCompetition.eligibleFamilies,
            familyCompetitionLeadingFamily: familyCompetition.leadingFamily,
            familyCompetitionTopSpread: familyCompetition.topSpread,
            familyCompetitionThreshold: familyCompetition.threshold,
            familyCompetitionWinnerMode: familyCompetition.winnerMode,
            expressionWidth: expressionWidth.classification,
            expressionWidthReason: expressionWidth.reason,
            expressionWidthFamilyCount: expressionWidth.familyCount,
            expressionWidthCompetitiveFamilyCount: expressionWidth.competitiveFamilyCount,
            expressionWidthIntensitySpread: expressionWidth.intensitySpread,
            expressionWidthPeakPoolSize: expressionWidth.peakPoolSize,
            expressionWidthFallbackReliance: expressionWidth.fallbackReliance,
            expressionReleaseScore: clamp01(expressionRelease.score),
            expressionReleasePenalty: clamp01(expressionRelease.penalty),
            expressionReleaseEligible: expressionRelease.eligible,
            expressionReleaseReason: expressionRelease.reason,
            expressionReleaseEliteCandidateNames: expressionRelease.eliteCandidateNames,
            expressionReleaseEliteFamilies: expressionRelease.eliteFamilies,
            expressionReleaseSelectedCandidateName: expressionRelease.selectedCandidateName,
            expressionReleaseSelectedFamily: expressionRelease.selectedFamily,
            expressionReleaseSelectionMode: expressionRelease.selectionMode,
            expressionReleaseDecision: expressionRelease.decision,
            eliteFieldDiversified: expressionRelease.diversified,
            eliteFieldDiversificationReason: expressionRelease.diversificationReason,
            eliteFieldDetectedLanes: expressionRelease.detectedLanes,
            eliteFieldLaneCandidates: expressionRelease.laneCandidates,
            eliteFieldCandidateNames: expressionRelease.eliteCandidateNames,
            eliteFieldCandidateLanes: expressionRelease.eliteCandidateLanes,
            activationMomentElevationScore: clamp01(activationMomentElevation.score),
            activationMomentElevationPenalty: clamp01(activationMomentElevation.penalty),
            activationMomentElevationEligible: activationMomentElevation.eligible,
            activationMomentElevationApplied: activationMomentElevation.applied,
            activationMomentElevationReason: activationMomentElevation.reason,
            activationMomentElevationCandidateNames: activationMomentElevation.candidateNames,
            activationMomentElevationCandidateFamilies: activationMomentElevation.candidateFamilies,
            activationMomentElevationTopCandidateName: activationMomentElevation.topCandidateName,
            activationMomentElevationTopCandidatePotential: activationMomentElevation.topCandidatePotential,
            activationMomentElevationWinnerElevated: activationMomentElevation.winnerElevated,
            fakeCompletenessPenalty: clamp01(fakeCompleteness.penalty),
            usedPartialArc: stops.length < 3,
            droppedWeakSupport: stops.length === 2,
            fakeCompletenessAvoided: fakeCompleteness.applied,
            recoveredCentralMomentHighlight,
            usedRecoveredCentralMomentHighlight: recoveredCentralMomentHighlight,
            centralMomentRecoveryReason: finalHighlight?.centralMomentRecoveryReason,
            highlightDominanceApplied: highlightIntegrity.highlightDominanceApplied,
            highlightFamilyAlignmentApplied: highlightIntegrity.highlightFamilyAlignmentApplied,
            highlightSupportPenaltyApplied: highlightIntegrity.highlightSupportPenaltyApplied,
        },
    };
}
