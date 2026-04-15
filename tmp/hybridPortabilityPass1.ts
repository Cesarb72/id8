import { buildDistrictOpportunityProfiles } from '../src/engines/district'
import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'

const cityCases = [
  { label: 'San Jose, CA', city: 'San Jose, CA', sourceMode: 'curated' as const },
  { label: 'Denver, CO', city: 'Denver, CO', sourceMode: 'curated' as const },
  { label: 'Austin, TX', city: 'Austin, TX', sourceMode: 'hybrid' as const },
]

const scenarios = [
  { label: 'Romantic + Cozy', persona: 'romantic', primaryVibe: 'cozy' },
  { label: 'Friends + Lively', persona: 'friends', primaryVibe: 'lively' },
  { label: 'Family + Cultured', persona: 'family', primaryVibe: 'cultured' },
] as const

async function run() {
  const report = [] as any[]

  for (const cityCase of cityCases) {
    const district = await buildDistrictOpportunityProfiles({
      locationQuery: cityCase.city,
      includeDebug: true,
    })

    const recommendations = [] as any[]
    for (const scenario of scenarios) {
      try {
        const preview = await previewDistrictRecommendations(
          {
            persona: scenario.persona,
            primaryVibe: scenario.primaryVibe,
            city: cityCase.city,
            distanceMode: 'nearby',
          },
          {
            sourceMode: cityCase.sourceMode,
            sourceModeOverrideApplied: true,
          },
        )
        recommendations.push({
          scenario: scenario.label,
          topDistrictId: preview.topDistrictId,
          districts: preview.recommendedDistricts.map((d) => ({
            districtId: d.districtId,
            label: d.label,
            score: d.score,
          })),
        })
      } catch (error) {
        recommendations.push({
          scenario: scenario.label,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    report.push({
      city: cityCase.label,
      recommendationSourceMode: cityCase.sourceMode,
      district: {
        source: district.location.source,
        displayLabel: district.location.displayLabel,
        cityMeta: district.location.meta.city,
        retrieval: district.retrieval,
        rawPockets: district.rawPockets.length,
        viablePockets: district.viablePockets.length,
        rejectedPockets: district.rejectedPockets.length,
        pathFlags: district.debug?.pathFlags,
        ranked: district.ranked.map((item) => ({
          rank: item.rank,
          label: item.profile.label,
          score: item.score,
          entityCount: item.profile.entityCount,
        })),
      },
      recommendations,
    })
  }

  console.log(JSON.stringify(report, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
