import { sanJoseVenues } from '../src/data/venues'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens'
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues'
import { buildDistrictOpportunityProfiles } from '../src/engines/district/core/buildDistrictOpportunityProfiles'
import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'

function countBy(items, keyFn) {
  const out = {}
  for (const item of items) {
    const key = keyFn(item)
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

function topEntries(record, limit = 10) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, value]) => ({ key, count: value }))
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function pickExamples(venues, predicate, limit = 8) {
  return venues.filter(predicate).slice(0, limit).map((v) => v.name)
}

async function main() {
  const curatedByCity = sanJoseVenues
  const curatedCategoryCounts = countBy(curatedByCity, (v) => v.category)
  const curatedNeighborhoodCounts = countBy(curatedByCity, (v) => v.neighborhood)
  const curatedSubcategoryCounts = countBy(curatedByCity, (v) => v.subcategory)

  const intent = normalizeIntent({
    city: 'San Jose',
    neighborhood: '',
    persona: 'romantic',
    primaryVibe: 'lively',
    distanceMode: 'nearby',
    crew: 'solo',
  })
  const lens = buildExperienceLens({ intent })
  const retrieval = await retrieveVenues(intent, lens)

  const retrieved = retrieval.venues
  const retrievedCategoryCounts = countBy(retrieved, (v) => v.category)
  const retrievedNeighborhoodCounts = countBy(retrieved, (v) => v.neighborhood)

  const districtResult = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })

  const entityTypeCounts = countBy(districtResult.entities, (e) => e.type)
  const entityCategoryCounts = countBy(
    districtResult.entities.flatMap((e) => e.categories ?? []),
    (c) => c,
  )
  const districtLabels = districtResult.ranked.map((entry) => entry.profile.label)

  const preview = await previewDistrictRecommendations({
    persona: 'romantic',
    primaryVibe: 'lively',
    city: 'San Jose',
    distanceMode: 'nearby',
  })

  const previewWithAgg = preview.recommendedDistricts.filter((d) => d.tasteAggregation)

  const eventCapableCount = retrieved.filter((v) => v.settings.eventCapable).length
  const musicCapableCount = retrieved.filter((v) => v.settings.musicCapable).length
  const performanceCapableCount = retrieved.filter((v) => v.settings.performanceCapable).length
  const highlightCapableCount = retrieved.filter((v) => v.highlightCapable).length
  const hiddenGemCount = retrieved.filter((v) => v.isHiddenGem).length
  const openNowCount = retrieved.filter((v) => v.source.openNow === true).length
  const hoursKnownCount = retrieved.filter((v) => v.source.hoursKnown).length
  const likelyOpenCount = retrieved.filter((v) => v.source.likelyOpenForCurrentWindow).length
  const lateCloseHints = retrieved.filter((v) =>
    `${v.shortDescription} ${v.narrativeFlavor} ${v.tags.join(' ')}`.toLowerCase().includes('late') ||
    `${v.shortDescription} ${v.narrativeFlavor} ${v.tags.join(' ')}`.toLowerCase().includes('night')
  ).length

  const majorVenueExamples = pickExamples(
    retrieved,
    (v) => /theatre|theater|opera|center|centre|arena|museum|stadium|hall/i.test(v.name),
    12,
  )
  const liveMusicExamples = pickExamples(retrieved, (v) => v.category === 'live_music' || v.settings.musicCapable, 12)
  const museumGalleryExamples = pickExamples(
    retrieved,
    (v) => v.category === 'museum' || /museum|gallery/i.test(v.name) || /gallery/i.test(v.subcategory),
    12,
  )
  const nightlifeExamples = pickExamples(
    retrieved,
    (v) => v.category === 'bar' || /cocktail|night|jazz|lounge|bar/i.test(v.subcategory),
    12,
  )
  const restaurantExamples = pickExamples(retrieved, (v) => v.category === 'restaurant', 12)
  const hiddenGemExamples = pickExamples(retrieved, (v) => v.isHiddenGem, 12)
  const marketCommunityExamples = pickExamples(
    retrieved,
    (v) => /market|plaza|community|square|district/i.test(v.name) || /market|community/i.test(v.subcategory),
    12,
  )
  const parkAtmosExamples = pickExamples(retrieved, (v) => v.category === 'park' || /garden|park|trail|walk/i.test(v.name), 12)

  const output = {
    scenario: 'San Jose + Romantic + Lively',
    curatedField: {
      total: curatedByCity.length,
      categoryCounts: curatedCategoryCounts,
      topSubcategories: topEntries(curatedSubcategoryCounts, 15),
      distinctNeighborhoods: Object.keys(curatedNeighborhoodCounts).length,
      topNeighborhoods: topEntries(curatedNeighborhoodCounts, 12),
    },
    retrievalField: {
      sourceMode: retrieval.sourceMode,
      stageCounts: retrieval.stageCounts,
      totalRetrieved: retrieved.length,
      categoryCounts: retrievedCategoryCounts,
      distinctNeighborhoods: Object.keys(retrievedNeighborhoodCounts).length,
      topNeighborhoods: topEntries(retrievedNeighborhoodCounts, 12),
      capabilityCounts: {
        eventCapableCount,
        musicCapableCount,
        performanceCapableCount,
        highlightCapableCount,
        hiddenGemCount,
      },
      temporalCounts: {
        openNowCount,
        hoursKnownCount,
        likelyOpenCount,
        lateCloseHints,
      },
      examples: {
        majorVenueExamples,
        liveMusicExamples,
        museumGalleryExamples,
        nightlifeExamples,
        restaurantExamples,
        hiddenGemExamples,
        marketCommunityExamples,
        parkAtmosExamples,
      },
    },
    districtEngineField: {
      retrievalSummary: districtResult.retrieval,
      entityCount: districtResult.entities.length,
      entityTypeCounts,
      topEntityCategories: topEntries(entityCategoryCounts, 18),
      rankedPocketCount: districtResult.ranked.length,
      selectedPocketCount: districtResult.selected.length,
      rankedDistrictLabels: districtLabels,
    },
    previewDistrictRecommendations: {
      count: preview.recommendedDistricts.length,
      withTasteAggregation: previewWithAgg.length,
      districtIds: preview.recommendedDistricts.map((d) => d.districtId),
      districtLabels: preview.recommendedDistricts.map((d) => d.label),
    },
  }

  console.log(JSON.stringify(output, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
