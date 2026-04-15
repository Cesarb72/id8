import { normalizeIntent } from '../src/domain/intent/normalizeIntent';
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens';
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy';
import { getRoleContract } from '../src/domain/contracts/getRoleContract';
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues';
import { scoreVenueCollection } from '../src/domain/retrieval/scoreVenueFit';
import { buildRolePools } from '../src/domain/arc/buildRolePools';
import { recommendDistricts } from '../src/domain/interpretation/district/recommendDistricts';
import { resolveDistrictAnchor } from '../src/domain/interpretation/district/resolveDistrictAnchor';
import { getVenueClusterId } from '../src/domain/spatial/getVenueClusterId';
import { detectMomentsFromTaste } from '../src/domain/interpretation/taste/detectMoments';
import { aggregateTasteOpportunityFromVenues } from '../src/domain/interpretation/taste/aggregateTasteOpportunityFromVenues';
const input = {
    persona: 'romantic',
    primaryVibe: 'lively',
    city: 'San Jose',
    distanceMode: 'nearby',
};
const intent = normalizeIntent({ ...input, district: undefined });
const lens = buildExperienceLens({ intent });
const crewPolicy = getCrewPolicy(intent.crew);
const roleContracts = getRoleContract({ intent });
const retrieval = await retrieveVenues(intent, lens, { requestedSourceMode: 'curated', sourceModeOverrideApplied: true });
const scored = scoreVenueCollection(retrieval.venues, intent, crewPolicy, lens, roleContracts);
const rolePools = buildRolePools(scored, crewPolicy, lens, intent, roleContracts);
const recommendations = recommendDistricts({ scoredVenues: scored, rolePools, intent, limit: 3 });
const clusterByVenue = new Map();
for (const sv of scored) {
    const clusterId = getVenueClusterId(sv.venue);
    const anchor = resolveDistrictAnchor({ city: intent.city, district: clusterId });
    clusterByVenue.set(sv.venue.id, { districtId: anchor.districtId, districtLabel: anchor.districtLabel });
}
const districtGroups = new Map();
for (const sv of scored) {
    const district = clusterByVenue.get(sv.venue.id);
    if (!district)
        continue;
    const current = districtGroups.get(district.districtId) ?? { districtLabel: district.districtLabel, venues: [] };
    current.venues.push(sv);
    districtGroups.set(district.districtId, current);
}
const categoryCounts = new Map();
for (const sv of scored) {
    categoryCounts.set(sv.venue.category, (categoryCounts.get(sv.venue.category) ?? 0) + 1);
}
const districtCounts = new Map();
for (const sv of scored) {
    const district = clusterByVenue.get(sv.venue.id);
    if (!district)
        continue;
    districtCounts.set(district.districtLabel, (districtCounts.get(district.districtLabel) ?? 0) + 1);
}
const total = scored.length;
const sortedDistrictCounts = [...districtCounts.entries()].sort((a, b) => b[1] - a[1]);
const topDistrictShare = total > 0 ? Number(((sortedDistrictCounts[0]?.[1] ?? 0) / total).toFixed(3)) : 0;
const top3DistrictShare = total > 0 ? Number((sortedDistrictCounts.slice(0, 3).reduce((s, [, c]) => s + c, 0) / total).toFixed(3)) : 0;
const strongHighlightCandidates = scored
    .map((sv) => {
    const s = sv.taste.signals;
    const highlightSignal = s.roleSuitability.highlight * 0.4 +
        (s.highlightTier === 1 ? 1 : s.highlightTier === 2 ? 0.72 : 0.44) * 0.2 +
        s.anchorStrength * 0.2 +
        s.momentIntensity.score * 0.1 +
        s.momentPotential.score * 0.1;
    return { sv, highlightSignal };
})
    .filter(({ highlightSignal }) => highlightSignal >= 0.66)
    .sort((a, b) => b.highlightSignal - a.highlightSignal);
const strongHighlightByDistrict = new Map();
for (const entry of strongHighlightCandidates) {
    const district = clusterByVenue.get(entry.sv.venue.id);
    const label = district?.districtLabel ?? 'Unknown';
    strongHighlightByDistrict.set(label, (strongHighlightByDistrict.get(label) ?? 0) + 1);
}
const allDetectedMoments = scored.flatMap((sv) => {
    const district = clusterByVenue.get(sv.venue.id);
    return detectMomentsFromTaste({
        venueId: sv.venue.id,
        venueName: sv.venue.name,
        districtId: district?.districtId,
        districtLabel: district?.districtLabel,
        tasteSignals: sv.taste.signals,
        context: {
            persona: intent.persona ?? undefined,
            vibe: intent.primaryAnchor,
            timeWindow: intent.timeWindow,
        },
        sourceFlags: {
            eventCapable: sv.venue.settings.eventCapable,
            musicCapable: sv.venue.settings.musicCapable,
            performanceCapable: sv.venue.settings.performanceCapable,
            highlightCapable: sv.venue.highlightCapable,
        },
        hoursStatus: sv.venue.source.openNow ? 'open' : 'unknown',
        hoursConfidence: sv.venue.source.timeConfidence,
    });
});
const momentTypeCounts = new Map();
for (const m of allDetectedMoments) {
    momentTypeCounts.set(m.momentType, (momentTypeCounts.get(m.momentType) ?? 0) + 1);
}
const aggregationByDistrict = new Map();
for (const [districtId, group] of districtGroups.entries()) {
    aggregationByDistrict.set(districtId, aggregateTasteOpportunityFromVenues(group.venues.map((sv) => ({
        venueId: sv.venue.id,
        venueName: sv.venue.name,
        districtId,
        districtLabel: group.districtLabel,
        lat: sv.venue.source.latitude,
        lng: sv.venue.source.longitude,
        fitScore: sv.fitScore,
        tasteSignals: sv.taste.signals,
        context: {
            persona: intent.persona ?? undefined,
            vibe: intent.primaryAnchor,
            timeWindow: intent.timeWindow,
        },
        sourceFlags: {
            eventCapable: sv.venue.settings.eventCapable,
            musicCapable: sv.venue.settings.musicCapable,
            performanceCapable: sv.venue.settings.performanceCapable,
            highlightCapable: sv.venue.highlightCapable,
        },
        hoursStatus: sv.venue.source.openNow ? 'open' : 'unknown',
        hoursConfidence: sv.venue.source.timeConfidence,
    }))));
}
const recommendedWithAgg = recommendations.map((r) => ({ ...r, tasteAggregation: aggregationByDistrict.get(r.districtId) }));
const aggregatedMomentsAll = recommendedWithAgg.flatMap((r) => [
    ...(r.tasteAggregation?.moments.primary ?? []),
    ...(r.tasteAggregation?.moments.secondary ?? []),
]);
const aggregatedAnchorMoments = aggregatedMomentsAll.filter((m) => m.momentType === 'anchor');
const anchorVenueSet = new Set(recommendedWithAgg
    .map((r) => r.tasteAggregation?.anchors.strongestHighlight?.venueName)
    .filter(Boolean));
const archetypeSet = new Set(recommendedWithAgg.flatMap((r) => r.tasteAggregation?.signatures.archetypes ?? []));
const momentVenueFrequency = new Map();
for (const m of aggregatedMomentsAll) {
    const key = m.title;
    momentVenueFrequency.set(key, (momentVenueFrequency.get(key) ?? 0) + 1);
}
const topFrequency = [...momentVenueFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
const runTopAnchors = [];
for (let i = 0; i < 5; i += 1) {
    const recs = recommendDistricts({ scoredVenues: scored, rolePools, intent, limit: 3 });
    const anchors = recs.map((r) => aggregationByDistrict.get(r.districtId)?.anchors.strongestHighlight?.venueName ?? 'n/a');
    runTopAnchors.push(anchors);
}
console.log(JSON.stringify({
    intent: { city: intent.city, persona: intent.persona, vibe: intent.primaryAnchor },
    inputField: {
        totalRetrievedForScoring: retrieval.venues.length,
        totalScoredVenues: scored.length,
        distinctDistricts: districtCounts.size,
        categoryDiversity: categoryCounts.size,
        districtCounts: sortedDistrictCounts,
        topDistrictShare,
        top3DistrictShare,
        retrievalStageCounts: retrieval.stageCounts,
    },
    anchors: {
        strongHighlightCandidateCount: strongHighlightCandidates.length,
        strongHighlightCandidatesTop: strongHighlightCandidates.slice(0, 20).map(({ sv, highlightSignal }) => ({
            venueName: sv.venue.name,
            district: clusterByVenue.get(sv.venue.id)?.districtLabel ?? 'Unknown',
            highlightSignal: Number(highlightSignal.toFixed(3)),
            highlightTier: sv.taste.signals.highlightTier,
            roleHighlight: Number(sv.taste.signals.roleSuitability.highlight.toFixed(3)),
            anchorStrength: Number(sv.taste.signals.anchorStrength.toFixed(3)),
        })),
        strongHighlightByDistrict: [...strongHighlightByDistrict.entries()].sort((a, b) => b[1] - a[1]),
        survivedStrongestHighlightsInTopDistricts: recommendedWithAgg.map((r) => ({ district: r.label, strongestHighlight: r.tasteAggregation?.anchors.strongestHighlight?.venueName ?? null })),
    },
    moments: {
        totalDetectedMomentsPreAggregation: allDetectedMoments.length,
        countsByTypePreAggregation: Object.fromEntries(momentTypeCounts.entries()),
        anchorMomentsPreAggregation: allDetectedMoments.filter((m) => m.momentType === 'anchor').length,
        totalMomentsPostAggregation: aggregatedMomentsAll.length,
        anchorMomentsPostAggregation: aggregatedAnchorMoments.length,
        postAggregationCountsByType: aggregatedMomentsAll.reduce((acc, m) => {
            acc[m.momentType] = (acc[m.momentType] ?? 0) + 1;
            return acc;
        }, {}),
    },
    diversity: {
        distinctAnchorVenuesInFinalAggregation: anchorVenueSet.size,
        distinctAnchorVenues: [...anchorVenueSet],
        distinctArchetypesInFinalAggregation: archetypeSet.size,
        archetypes: [...archetypeSet],
        topMomentVenueFrequency: topFrequency,
    },
    repetition: {
        topAnchorsAcrossFiveRuns: runTopAnchors,
        uniqueTopAnchorTriplets: Array.from(new Set(runTopAnchors.map((set) => set.join(' | ')))),
    },
}, null, 2));
