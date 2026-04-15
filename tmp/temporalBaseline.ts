import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'

const scenarios = [
  { label: 'Romantic + Cozy', persona: 'romantic', primaryVibe: 'cozy' },
  { label: 'Friends + Lively', persona: 'friends', primaryVibe: 'lively' },
  { label: 'Family + Cultured', persona: 'family', primaryVibe: 'cultured' },
] as const

async function run() {
  const rows = [] as Array<{
    scenario: string
    topDistrictId?: string
    recommended: Array<{ districtId: string; label: string; score: number; reason: string; debug?: unknown }>
  }>

  for (const scenario of scenarios) {
    const result = await previewDistrictRecommendations(
      {
        persona: scenario.persona,
        primaryVibe: scenario.primaryVibe,
        city: 'San Jose',
        distanceMode: 'nearby',
      },
      { sourceMode: 'curated', sourceModeOverrideApplied: true },
    )

    rows.push({
      scenario: scenario.label,
      topDistrictId: result.topDistrictId,
      recommended: result.recommendedDistricts.map((district) => ({
        districtId: district.districtId,
        label: district.label,
        score: district.score,
        reason: district.reason,
        debug: district.debug,
      })),
    })
  }

  console.log(JSON.stringify({ scenarios: rows }, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
