import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'
import { getHospitalityScenarioContract } from '../src/domain/interpretation/taste/scenarioContracts'
import { buildExperienceContractFromScenarioContract } from '../src/domain/interpretation/contracts/experienceContract'
import { applyScenarioContractToAggregation } from '../src/domain/interpretation/taste/applyScenarioContractToOpportunityAggregation'
import { applyExperienceContractToAggregation } from '../src/domain/interpretation/taste/applyExperienceContractToOpportunityAggregation'

const city = 'San Jose'
const persona = 'romantic'
const vibes = ['cozy', 'lively', 'cultured'] as const

for (const vibe of vibes) {
  const result = await previewDistrictRecommendations({
    city,
    persona,
    primaryVibe: vibe,
    budget: '$$',
  })
  const scenario = getHospitalityScenarioContract({ city, persona, vibe })
  const experience = buildExperienceContractFromScenarioContract(scenario)

  const cards = result.recommendedDistricts
    .filter((district) => Boolean(district.tasteAggregation))
    .map((district) => {
      const base = district.tasteAggregation!
      const scenarioShaped = applyScenarioContractToAggregation(base, scenario)
      const shaped = applyExperienceContractToAggregation(scenarioShaped, experience)
      const anchor = shaped.anchors.strongestHighlight
      const start = shaped.ingredients.startCandidates[0]
      const wind = shaped.ingredients.windDownCandidates[0]
      const primaryMomentTypes = shaped.moments.primary.slice(0, 4).map((moment) => moment.momentType)
      return {
        district: district.name,
        anchor: anchor?.venueName ?? null,
        anchorScore: anchor?.score ?? null,
        start: start?.venueName ?? null,
        windDown: wind?.venueName ?? null,
        summary: shaped.summary,
        moments: primaryMomentTypes,
      }
    })
    .slice(0, 4)

  console.log('\n===', `${city} | ${persona} | ${vibe}`, '===')
  for (const card of cards) {
    console.log(JSON.stringify(card))
  }
}
